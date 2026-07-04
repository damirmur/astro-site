#!/bin/bash

cd pb_public

# Список JS файлов в нужном порядке (указывать БЕЗ расширения .js)
JS_FILES=("constants" "api" "elements" "ui" "app")

# Автоматически собираем регулярное выражение для sed (пример: constants|api|elements|ui|app)
SED_PATTERN=$(printf "|%s" "${JS_FILES[@]}")
SED_PATTERN=${SED_PATTERN:1}

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

# Извлекаем body, динамически удаляя строки с подключением файлов из списка
sed -n '/<body>/,/<\/body>/p' index.html | \
sed '1d;$d' | \
sed -E "/(${SED_PATTERN})\.js/d" >> temp.html

# Добавляем заголовки для встроенных скриптов
cat >> temp.html << 'EOF'

    <!-- Скрипты -->
EOF

# Вшиваем JS файлы по списку из массива
for file in "${JS_FILES[@]}"; do
    echo "    <script>" >> temp.html
    echo "        // ${file}.js" >> temp.html
    cat "${file}.js" >> temp.html
    echo -e "\n    </script>" >> temp.html
done

# Закрываем теги
cat >> temp.html << 'EOF'
</body>
</html>
EOF

echo "✅ temp.html создан в pb_public/"
echo "📁 Обработано файлов: ${#JS_FILES[@]} (${JS_FILES[*]}...)"

