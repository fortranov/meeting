FROM php:8.2-apache

# Install SQLite3 support
RUN apt-get update \
    && apt-get install -y libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite \
    && rm -rf /var/lib/apt/lists/*

# Enable mod_rewrite
RUN a2enmod rewrite

# Configure Apache: prefer index.php, allow .htaccess
RUN sed -i 's/DirectoryIndex index.html index.cgi index.pl index.php index.xhtml index.htm/DirectoryIndex index.php index.html/' \
        /etc/apache2/mods-enabled/dir.conf \
    && printf '<Directory /var/www/html>\n\tAllowOverride All\n\tRequire all granted\n</Directory>\n' \
        > /etc/apache2/conf-enabled/app.conf

# Copy application files
COPY . /var/www/html/

# Create persistent data directory for SQLite outside webroot
RUN mkdir -p /data \
    && chown www-data:www-data /data \
    && rm -f /var/www/html/.gitkeep /var/www/html/meeting.sqlite

# Ensure webroot is owned by www-data
RUN chown -R www-data:www-data /var/www/html

# DB_PATH can be overridden at runtime via env variable
ENV DB_PATH=/data/meeting.sqlite

EXPOSE 80
