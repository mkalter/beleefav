# Gebruik de officiële Node.js image. Kies de specifieke versie die je nodig hebt.
FROM node:14

# Creëer een directory om de app-code in te plaatsen
WORKDIR /usr/src/app

# Kopieer package.json en package-lock.json
COPY package*.json ./

# Installeer alle afhankelijkheden
RUN npm install

# Kopieer alle bestanden van het project naar de werkdirectory
COPY . .

# De app bindt op port 3000, dus je moet deze poort openstellen
EXPOSE 3000

# Definieer het commando om de app te starten
CMD ["node", "app.js"]
