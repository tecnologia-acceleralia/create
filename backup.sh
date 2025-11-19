#!/bin/bash
# Backup script

BACKUP_DIR="/home/$USER/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2 | tr -d '"' || echo "create")
DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2 | tr -d '"' || echo "root")
DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' || echo "root")
docker-compose exec -T -e MYSQL_PWD="${DB_PASSWORD}" database mysqldump -u"${DB_USER}" "${DB_NAME}" > $BACKUP_DIR/db_backup_$DATE.sql

# Backup uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz uploads/

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"

# Renew SSL certificate (if needed)
sudo certbot renew --quiet
