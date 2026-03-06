#!/bin/bash
rm -rf dist
mkdir -p dist/images dist/attached_assets

cp -f *.html *.js *.css dist/ 2>/dev/null
cp -f *.png *.webp *.jpg *.gif *.mp4 *.svg dist/ 2>/dev/null
cp -f *.json dist/ 2>/dev/null
rm -f dist/package.json dist/package-lock.json 2>/dev/null

cp -rf images/* dist/images/ 2>/dev/null
cp -rf envs dist/envs 2>/dev/null

for file in index.html coming-soon.html homepage.html 404.html script.js style.css; do
  if [ -f "$file" ]; then
    grep -oh 'attached_assets/[^"'"'"' )]*' "$file" 2>/dev/null
  fi
done | sort -u | while read -r asset; do
  if [ -f "$asset" ]; then
    cp -f "$asset" "dist/$asset"
  fi
done

echo "Build complete!"
du -sh dist/
