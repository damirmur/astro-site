#!/bin/bash

cd pb_public || { echo "Ошибка: Не удалось перейти в директорию pb_public!"; exit 1; }

if [ ! -f temp.html ]; then
    echo "Ошибка: файл temp.html не найден!"
    exit 1
fi

# 1. Извлекаем стили в styles.css
sed -n '/<style>/,/<\/style>/p' temp.html | sed '1d;$d' > styles.css

# 2. Список файлов для поиска и извлечения
js_files=("constants.js" "api.js" "elements.js" "ui.js" "app.js")

# Строка, куда мы соберем теги подключения скриптов
script_tags=""

# 3. Извлекаем каждый скрипт в свой файл
for filename in "${js_files[@]}"; do
    # Накапливаем теги подключения для index.html (с правильными отступами)
    script_tags="${script_tags}\n    <script src=\"${filename}\"></script>"

    awk -v file="$filename" '
        /<script>/ { 
            in_script=1; 
            script_content=""; 
            has_marker=0; 
            next; 
        }
        /<\/script>/ { 
            in_script=0; 
            if (has_marker) { 
                print script_content > file; 
            } 
            next; 
        }
        in_script { 
            if ($0 ~ "\\/\\/[ \t]*" file) { 
                has_marker=1; 
            } else {
                if (script_content == "") {
                    script_content = $0;
                } else {
                    script_content = script_content "\n" $0;
                }
            }
        }
    ' temp.html
done

# 4. Формируем тело index.html (сохраняя структуру и сторонние скрипты)
body_content=$(awk '
    BEGIN { in_body=0; in_script=0; script_buf=""; has_marker=0; }
    
    /<body[^>]*>/ { in_body=1; next; }
    /<\/body>/ { in_body=0; next; }
    
    in_body {
        if (/<script>/) {
            in_script=1;
            script_buf = $0;
            has_marker=0;
            next;
        }
        if (/<\/script>/) {
            in_script=0;
            script_buf = script_buf "\n" $0;
            if (!has_marker) {
                print script_buf;
            }
            next;
        }
        
        if (in_script) {
            script_buf = script_buf "\n" $0;
            if ($0 ~ /\/\/[ \t]*(constants\.js|api\.js|elements\.js|ui\.js|app\.js|carts.js)/) {
                has_marker=1;
            }
        } else {
            print $0;
        }
    }
' temp.html)

# 5. Записываем итоговый файл index.html (добавляя ссылки на скрипты перед </body>)
cat > index.html << EOF
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ЛК astro3D.ru</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
$body_content
$(printf "$script_tags")
</body>
</html>
EOF

echo "🔄 Разбор завершен!"
echo "📁 Базовые скрипты извлечены, ссылки на них добавлены в index.html."
