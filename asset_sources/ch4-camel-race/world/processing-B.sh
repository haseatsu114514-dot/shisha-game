set -eu
cd /workspace/camel-work
mkdir -p asset_sources/ch4-camel-race/world/{originals,candidates,review}
b=asset_sources/ch4-camel-race/world
cp /workspace/generated_images/exec-ccfe5ee4-c1bb-49aa-bd15-94c87fd4577f.png "$b/originals/remote-voice-normal-B.png"
cp /workspace/generated_images/exec-27b37dae-32c5-41e8-b830-ef9c13cde6ae.png "$b/originals/remote-voice-pressed-B.png"
cp /workspace/generated_images/exec-52c96686-6b99-4816-82af-c28e4db31eb0.png "$b/originals/remote-whip-normal-B.png"
cp /workspace/generated_images/exec-addb2d11-89bc-44ce-99b6-541564471e20.png "$b/originals/remote-whip-pressed-B-rejected.png"
cp /workspace/generated_images/exec-7d584b75-c4e4-4e6c-8755-d78e46009fb5.png "$b/originals/ground-road-B.png"
convert "$b/originals/remote-voice-normal-B.png" -resize 720x240! "$b/candidates/remote-voice-normal-B.png"
convert -size 2172x724 xc:black -fill white -draw 'ellipse 310,352 300,310 0,360' mask.png
for name in remote-voice-pressed remote-whip-normal; do
 convert "$b/originals/$name-B.png" mask.png -alpha off -compose CopyOpacity -composite overlay.png
 convert "$b/originals/remote-voice-normal-B.png" overlay.png -compose Over -composite -resize 720x240! "$b/candidates/$name-B.png"
done
convert "$b/originals/ground-road-B.png" -resize 640x152! -alpha off road-half.png
convert road-half.png \( road-half.png -flop \) +append "$b/candidates/ground-road-B.png"

# Final whip pressed raw: exec-9584de6d-c261-466a-aeaa-0866a189dd5c.png; same elliptical composition as other states.
