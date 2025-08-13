#!/usr/bin/env python3
"""
Create CI-themed icons for CI HQ Extension with microscope/analysis theme
"""
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import os
import math

def create_microscope_icon(size, filename):
    """Create a microscope-style icon for competitive intelligence"""
    if not PIL_AVAILABLE:
        return False
        
    # Create image with gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle with CI HQ colors
    margin = max(1, size // 16)
    draw.ellipse([margin, margin, size-margin, size-margin], 
                fill='#4F46E5', outline='#312E81', width=max(1, size//32))
    
    # Scale factors for different sizes
    s = size / 48.0  # Base size 48px
    
    # Microscope base
    base_y = int(size * 0.75)
    base_width = int(size * 0.4)
    base_x = (size - base_width) // 2
    draw.rectangle([base_x, base_y, base_x + base_width, base_y + int(6*s)], 
                  fill='white', outline='#E5E7EB', width=max(1, int(s)))
    
    # Microscope body (main tube)
    body_x = size // 2 - int(3*s)
    body_y = int(size * 0.3)
    body_width = int(6*s)
    body_height = int(size * 0.45)
    draw.rectangle([body_x, body_y, body_x + body_width, body_y + body_height], 
                  fill='white', outline='#D1D5DB', width=max(1, int(s)))
    
    # Eyepiece
    eye_x = body_x - int(2*s)
    eye_y = body_y - int(4*s)
    eye_width = int(10*s)
    eye_height = int(4*s)
    draw.rectangle([eye_x, eye_y, eye_x + eye_width, eye_y + eye_height], 
                  fill='white', outline='#9CA3AF', width=max(1, int(s)))
    
    # Lens/objective
    lens_x = body_x + int(s)
    lens_y = body_y + body_height - int(2*s)
    lens_size = int(4*s)
    draw.ellipse([lens_x, lens_y, lens_x + lens_size, lens_y + lens_size], 
                fill='#FEF3C7', outline='#F59E0B', width=max(1, int(s)))
    
    # Add some analysis dots/data points
    if size >= 32:
        for i in range(3):
            dot_x = int(size * 0.2 + i * size * 0.1)
            dot_y = int(size * 0.85)
            dot_size = max(2, int(2*s))
            draw.ellipse([dot_x, dot_y, dot_x + dot_size, dot_y + dot_size], 
                        fill='#10B981')
    
    img.save(filename, 'PNG')
    print(f"🔬 Created microscope icon {filename} ({size}x{size})")
    return True

def create_analysis_icon(size, filename):
    """Create an analysis/investigation themed icon"""
    if not PIL_AVAILABLE:
        return False
        
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle
    margin = max(1, size // 16)
    draw.ellipse([margin, margin, size-margin, size-margin], 
                fill='#4F46E5', outline='#312E81', width=max(1, size//24))
    
    s = size / 48.0  # Scale factor
    
    # Magnifying glass handle
    handle_start_x = int(size * 0.65)
    handle_start_y = int(size * 0.65)
    handle_end_x = int(size * 0.85)
    handle_end_y = int(size * 0.85)
    handle_width = max(2, int(3*s))
    
    # Draw handle
    draw.line([(handle_start_x, handle_start_y), (handle_end_x, handle_end_y)], 
             fill='white', width=handle_width)
    
    # Magnifying glass circle
    center_x = int(size * 0.4)
    center_y = int(size * 0.4)
    glass_radius = int(size * 0.25)
    
    # Glass circle (outer)
    draw.ellipse([center_x - glass_radius, center_y - glass_radius, 
                 center_x + glass_radius, center_y + glass_radius], 
                outline='white', width=max(2, int(2*s)))
    
    # Inner glass area
    inner_radius = int(glass_radius * 0.8)
    draw.ellipse([center_x - inner_radius, center_y - inner_radius, 
                 center_x + inner_radius, center_y + inner_radius], 
                fill='rgba(255, 255, 255, 0.3)', outline='#E5E7EB', width=max(1, int(s)))
    
    # Data points being analyzed
    if size >= 24:
        points = [
            (center_x - int(8*s), center_y - int(5*s)),
            (center_x + int(2*s), center_y - int(8*s)),
            (center_x - int(3*s), center_y + int(6*s)),
            (center_x + int(7*s), center_y + int(2*s))
        ]
        for px, py in points:
            dot_size = max(1, int(2*s))
            draw.ellipse([px, py, px + dot_size, py + dot_size], fill='#10B981')
    
    img.save(filename, 'PNG')
    print(f"🔍 Created analysis icon {filename} ({size}x{size})")
    return True

def create_fallback_icons():
    """Create simple text-based icons without PIL"""
    print("Creating simple fallback icons...")
    
    # This is a very basic PNG - just for functionality
    sizes = [(16, 'public/icon16.png'), (48, 'public/icon48.png'), (128, 'public/icon128.png')]
    
    # Simple 1x1 blue pixel PNG (minimal but functional)
    basic_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    
    for size, filename in sizes:
        with open(filename, 'wb') as f:
            f.write(basic_png)
        print(f"📄 Created basic {filename}")

def main():
    os.chdir('/Users/varun/projects/ci_ext/ci-hq-extension-final')
    
    print("🎯 Creating CI-themed icons for CI HQ Extension...")
    
    if PIL_AVAILABLE:
        print("🎨 Using PIL to create professional icons...")
        # Create microscope themed icons
        create_microscope_icon(16, 'public/icon16.png')
        create_analysis_icon(48, 'public/icon48.png')  
        create_microscope_icon(128, 'public/icon128.png')
        print("✅ Professional CI-themed icons created!")
    else:
        print("⚠️  PIL not available. Installing via pip...")
        import subprocess
        try:
            subprocess.check_call(['pip3', 'install', 'pillow'])
            print("✅ PIL installed! Re-run this script.")
        except:
            print("❌ Could not install PIL. Creating basic icons...")
            create_fallback_icons()
    
    print("🔬 Icons updated! Perfect for competitive intelligence analysis.")

if __name__ == "__main__":
    main()