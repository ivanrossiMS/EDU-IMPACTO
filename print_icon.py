from PIL import Image

img = Image.open('android/app/src/main/res/drawable-mdpi/ic_stat_onesignal_default.png')
img = img.convert("RGBA")
pixels = img.load()

for y in range(img.height):
    line = ""
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        if a > 128:
            line += "##"
        else:
            line += ".."
    print(line)
