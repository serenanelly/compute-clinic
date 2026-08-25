FROM python:3.13-slim

# Configuration de Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Espace de travail
WORKDIR /app

# Installation des dépendances système nécessaires
RUN apt-get update && apt-get install -y libpq-dev gcc

# Installation des paquets Python
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copie de tout le code source dans l'image
COPY . /app/
