#!/bin/bash

# Переходим в папку проекта
cd /home/dmyr/app/astro-site

echo "Попытка компиляции..."
/usr/local/go/bin/go build -o astro-site-new ./cmd/astro-site/main.go && mv astro-site-new astro-site-bin

# Проверяем, существует ли бинарник
if [ -f "./astro-site-bin" ]; then
    echo "Запуск веб-сервера..."
    # ДОБАВИЛИ: serve и привязку к порту 8081 локального интерфейса
    exec ./astro-site-bin serve --http="127.0.0.1:8081"
else
    echo "Критическая ошибка: Бинарник astro-site-bin не найден!"
    exit 1
fi
