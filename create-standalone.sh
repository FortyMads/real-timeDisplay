#!/bin/bash

# Script to create a standalone HTML file with inlined resources

echo "Creating standalone HTML file..."

# Read the content of the files
POLYFILLS=$(cat polyfills-B6TNHZQ6.js)
MAIN=$(cat main-C5PDVNZE.js)
STYLES=$(cat styles-5INURTSO.css)

# Create the standalone HTML file
cat > complete-standalone.html << 'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Real-Time Display System</title>
  <base href="./">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏱️</text></svg>">
  <style>
EOF

# Add any styles if they exist
if [ -s "styles-5INURTSO.css" ]; then
    cat styles-5INURTSO.css >> complete-standalone.html
fi

cat >> complete-standalone.html << 'EOF'
  </style>
</head>
<body>
  <app-root></app-root>
  
  <script type="module">
EOF

# Add the polyfills
cat polyfills-B6TNHZQ6.js >> complete-standalone.html

cat >> complete-standalone.html << 'EOF'
  </script>
  
  <script type="module">
EOF

# Add the main application
cat main-C5PDVNZE.js >> complete-standalone.html

cat >> complete-standalone.html << 'EOF'
  </script>
  
  <noscript>
    <div style="text-align: center; padding: 2rem; font-size: 1.2rem; color: #333; background: #f9f9f9; height: 100vh; display: flex; flex-direction: column; justify-content: center;">
      <h2>JavaScript Required</h2>
      <p>This Real-Time Display System requires JavaScript to function properly.</p>
      <p>Please enable JavaScript in your browser and reload the page.</p>
    </div>
  </noscript>
</body>
</html>
EOF

echo "Standalone HTML file created: complete-standalone.html"
echo "File size: $(du -h complete-standalone.html | cut -f1)"
