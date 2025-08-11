# CI Feature Extractor

Extract competitor features and pricing from any website using AI. Perfect for competitive intelligence, market research, and product analysis.

## 🚀 Quick Installation

### Step 1: Download the Extension
1. Click the green "Code" button above and select "Download ZIP"
2. Extract the ZIP file to a folder on your computer

### Step 2: Install in Chrome
1. Open Google Chrome
2. Go to `chrome://extensions/` (copy and paste this into your address bar)
3. Turn on "Developer mode" (toggle switch in the top right)
4. Click "Load unpacked" button
5. Select the folder where you extracted the files
6. The extension is now installed! You'll see the CI Feature Extractor icon in your toolbar

### Step 3: Configure Supabase (No local OpenAI key needed)
The extension calls a Supabase Edge Function that holds your server-side OpenAI key. Users authenticate and calls are proxied securely.

1. Create a Supabase project and deploy the Edge Function as described in `EDGE-FUNCTION-SETUP.md`.
2. In the dashboard Settings page, set your Supabase URL and anon key if different from defaults.
3. Use the in-extension login (email + code) to authenticate.

## ✨ How to Use

1. **Visit any competitor's website** (pricing pages, feature pages, product pages)
2. **Click the extension icon** in your toolbar
3. **Click "Extract Features"** for quick analysis
4. **Use "Think More"** for deeper strategic insights
5. **Copy results** to use in your reports

## 🎯 What It Analyzes

- **Product Features**: Core capabilities and functionality
- **Pricing Plans**: Pricing structure and plan details
- **Target Market**: Who the product is designed for
- **Competitive Positioning**: How they position themselves
- **Strategic Insights**: Business model and market opportunities

## 🤖 AI Models Available

**For Quick Analysis:**
- GPT-4o-mini (Fast & Affordable) ⭐ *Recommended*
- GPT-4o (Higher Quality)
- o3-mini (Advanced Reasoning)
- o3 (Most Powerful)

**For Deep Strategic Analysis:**
- o3-mini (Cost-effective) ⭐ *Recommended*
- o3 (Premium Analysis)

## 🔒 Privacy & Security

- ✅ Your data is sent only to your Supabase Edge Function (and OpenAI), using your authenticated session
- ✅ No OpenAI API keys are stored in the extension
- ✅ Row Level Security in Supabase restricts data to each user
- ✅ Open source code for transparency

## 💡 Pro Tips

- **Add your company context** in settings for comparative analysis
- **Use custom prompts** in "Think More" for specific questions
- **Start with pricing pages** for the most structured data
- **Monitor your usage** in the dashboard to track API costs

## ❓ Troubleshooting

**Extension not working?**
- Make sure you've entered a valid OpenAI API key
- Check that your API key has access to the selected models
- Try refreshing the webpage and clicking the extension again

**Getting errors?**
- Verify your OpenAI account has sufficient credits
- Make sure the website has loaded completely before analyzing

## 📄 License

MIT License - Free to use and modify

---

*This tool is for legitimate competitive research only. Please respect website terms of service and applicable laws.*