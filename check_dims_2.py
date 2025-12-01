import os
from PIL import Image

files = [
    r'e:\projects\cut-the-land\public\assets\theme\forest\monster.png',
    r'e:\projects\cut-the-land\public\assets\theme\forest\player_moving.png'
]

for path in files:
    if os.path.exists(path):
        try:
            img = Image.open(path)
            print(f"{os.path.basename(path)}: {img.size} (Width x Height)")
        except Exception as e:
            print(f"Error opening {path}: {e}")
    else:
        print(f"{path} not found")
