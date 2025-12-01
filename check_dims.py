import os
from PIL import Image

assets_dir = r'e:\projects\cut-the-land\public\assets'
files = ['monster_boss.png', 'monster_boss_skill.png']

for f in files:
    path = os.path.join(assets_dir, f)
    if os.path.exists(path):
        try:
            img = Image.open(path)
            print(f"{f}: {img.size} (Width x Height)")
        except Exception as e:
            print(f"Error opening {f}: {e}")
    else:
        print(f"{f} not found")
