#!/usr/bin/env python3
"""
Create basic placeholder icons for CI HQ Extension
"""
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import os

def create_simple_icon(size, filename):
    """Create a simple colored square icon with CI text"""
    if PIL_AVAILABLE:
        # Create image with PIL
        img = Image.new('RGB', (size, size), color='#4F46E5')
        draw = ImageDraw.Draw(img)
        
        # Try to use a font, fall back to default if not available
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", max(size//4, 8))
        except:
            font = ImageFont.load_default()
        
        # Draw white circle
        circle_size = int(size * 0.7)
        circle_pos = (size - circle_size) // 2
        draw.ellipse([circle_pos, circle_pos, circle_pos + circle_size, circle_pos + circle_size], 
                    fill='white')
        
        # Draw CI text
        text = "CI"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = (size - text_width) // 2
        text_y = (size - text_height) // 2
        draw.text((text_x, text_y), text, fill='#4F46E5', font=font)
        
        img.save(filename, 'PNG')
        print(f"✅ Created {filename} ({size}x{size})")
        return True
    else:
        print(f"❌ PIL not available, skipping {filename}")
        return False

def create_fallback_icons():
    """Create very basic icons without PIL"""
    sizes = [(16, 'public/icon16.png'), (48, 'public/icon48.png'), (128, 'public/icon128.png')]
    
    for size, filename in sizes:
        # Create a minimal PNG manually (this is a hack but works for testing)
        # This creates a tiny red square - not pretty but functional
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x10\x00\x00\x00\x10\x08\x02\x00\x00\x00\x90\x91h6\x00\x00\x00\x19tEXtSoftware\x00Adobe ImageReadyq\xc9e<\x00\x00\x00\x0eIDATx\x9cc```\xf8\x0f\x00\x01\x00\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        
        with open(filename, 'wb') as f:
            f.write(png_data)
        print(f"✅ Created basic {filename} ({size}x{size})")

def main():
    os.chdir('/Users/varun/projects/ci_ext/ci-hq-extension-final')
    
    print("🎨 Creating placeholder icons for CI HQ Extension...")
    
    if PIL_AVAILABLE:
        print("📐 Using PIL for high-quality icons...")
        create_simple_icon(16, 'public/icon16.png')
        create_simple_icon(48, 'public/icon48.png')
        create_simple_icon(128, 'public/icon128.png')
    else:
        print("⚠️  PIL not available, creating basic placeholders...")
        create_fallback_icons()
    
    print("🎉 Icons created! You can now load the extension.")

if __name__ == "__main__":
    main()