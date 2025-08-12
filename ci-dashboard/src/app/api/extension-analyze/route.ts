import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    const body = await request.json()
    const { pageData, accessToken } = body

    if (!pageData || !accessToken) {
      return NextResponse.json({ error: 'Page data and access token required' }, { status: 400 })
    }

    // Set the auth token for Supabase client
    supabase.auth.setSession({ access_token: accessToken, refresh_token: '' })

    // Get user
    const { data: user, error: userError } = await supabase.auth.getUser()
    if (userError || !user.user) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const domain = pageData.domain || new URL(pageData.url).hostname.replace(/^www\./, '')
    const textContent = pageData.textContent || ''

    // Determine if it's a pricing page
    const isPricingPage = pageData.title?.toLowerCase().includes('pricing') || 
                         textContent.toLowerCase().includes('plan') && textContent.toLowerCase().includes('price')

    // Create analysis based on extension-provided data
    let analysis: string
    
    if (isPricingPage) {
      analysis = `📋 PRICING ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}
Source: ${pageData.url}
Analyzed via Extension

## Pricing Plans Analysis
Based on content from ${domain}:

${pageData.headings?.length > 0 ? 
`## Key Sections Found:
${pageData.headings.slice(0, 5).map(h => `• ${h}`).join('\n')}

` : ''}## Pricing Structure
• Identified as a pricing/plans page
• Contains pricing-related content and plan information
• Multiple tiers or subscription options likely available

## Key Features by Plan
• Feature differentiation across pricing tiers
• Varying levels of service and capabilities
• Enterprise and custom pricing options

## Call-to-Actions
${pageData.buttons?.length > 0 ? 
pageData.buttons.slice(0, 5).map(btn => `• ${btn}`).join('\n') : 
'• Standard subscription CTA patterns'
}

---
Powered by Extension Analysis | CI Feature Extractor`
    } else {
      analysis = `📋 FEATURE EXTRACTION REPORT  
Generated: ${new Date().toLocaleString()}
Source: ${pageData.url}
Analyzed via Extension

## Core Features
Based on analysis of ${domain}:
${pageData.headings?.length > 0 ? 
`
### Main Sections:
${pageData.headings.slice(0, 8).map(h => `• ${h}`).join('\n')}
` : ''}
## Key Capabilities
• ${textContent.length > 1000 ? 'Comprehensive web platform' : 'Web-based service'}
• User-focused design and functionality
• Modern web application architecture
${pageData.buttons?.length > 0 ? `• Interactive elements: ${pageData.buttons.slice(0, 3).join(', ')}` : ''}

## Target Users
• Professional/business-oriented audience
• Users seeking ${domain.split('.')[0]} solutions
• ${pageData.forms?.length > 0 ? 'Lead generation and user acquisition focus' : 'Information and service oriented'}

## Technical Analysis
• Domain: ${domain}
• Page title: ${pageData.title}
• Content depth: ${textContent.length > 5000 ? 'Extensive' : textContent.length > 2000 ? 'Moderate' : 'Basic'}
• Navigation elements: ${pageData.links?.length || 0} links found

---
Powered by Extension Analysis | CI Feature Extractor`
    }

    // Save to Supabase
    const analysisData = {
      user_id: user.user.id,
      title: pageData.title || `Analysis of ${domain}`,
      url: pageData.url,
      domain: domain,
      analysis_type: isPricingPage ? 'pricing_analysis' : 'feature_extraction',
      content: analysis,
      page_data: pageData,
      model_used: 'extension-analyzer',
      token_count: Math.ceil(analysis.length / 4)
    }

    const { data: savedAnalysis, error: saveError } = await supabase
      .from('analyses')
      .insert(analysisData)
      .select()
      .single()

    if (saveError) {
      console.error('Save error:', saveError)
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    return NextResponse.json({ 
      analysis,
      analysisId: savedAnalysis.id,
      success: true 
    })

  } catch (error) {
    console.error('Extension analysis error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}