from PIL import Image
import os

source_path = "img/icons/new-logo.png"
dest_path = "img/icons/new-logo_dobrado.png"

try:
    if not os.path.exists(source_path):
        print(f"Error: {source_path} not found.")
        exit(1)

    with Image.open(source_path) as img:
        original_size = img.size
        new_size = (original_size[0] * 2, original_size[1] * 2)
        
        # Use high quality resizing (LANCZOS)
        resized_img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        resized_img.save(dest_path)
        print(f"Success: Resized from {original_size} to {new_size}. Saved at {dest_path}")

except Exception as e:
    print(f"Error: {e}")
    exit(1)
