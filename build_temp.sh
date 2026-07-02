#!/bin/bash

cd pb_public

# Создаем temp.html с началом
cat > temp.html << 'EOF'
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Astro App</title>
    
    <!-- Объединенные стили -->
    <style>
EOF

# Добавляем styles.css
cat styles.css >> temp.html

# Закрываем style и открываем body
cat >> temp.html << 'EOF'
    </style>
</head>
<body>
EOF

# Копируем содержимое body из index.html (без тегов body)
sed -n '/<body>/,/<\/body>/p' index.html | sed '1d;$d' >> temp.html

# Добавляем скрипты с отдельными тегами
cat >> temp.html << 'EOF'
    
    <!-- Скрипты -->
EOF

# constants.js
cat >> temp.html << 'EOF'
    <script>
        // constants.js
EOF
cat constants.js >> temp.html
cat >> temp.html << 'EOF'
    </script>
EOF

# api.js
cat >> temp.html << 'EOF'
    <script>
        // api.js
EOF
cat api.js >> temp.html
cat >> temp.html << 'EOF'
    </script>
EOF

# elements.js
cat >> temp.html << 'EOF'
    <script>
        // elements.js
EOF
cat elements.js >> temp.html
cat >> temp.html << 'EOF'
    </script>
EOF

# ui.js
cat >> temp.html << 'EOF'
    <script>
        // ui.js
EOF
cat ui.js >> temp.html
cat >> temp.html << 'EOF'
    </script>
EOF

# app.js
cat >> temp.html << 'EOF'
    <script>
        // app.js
EOF
cat app.js >> temp.html
cat >> temp.html << 'EOF'
    </script>
EOF

# Закрываем теги
cat >> temp.html << 'EOF'
</body>
</html>
EOF

echo "✅ temp.html создан в pb_public/"
echo "📁 Все скрипты разделены по тегам <script>"
