<<<<<<< HEAD
FROM node:10
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production
# Bundle app source
COPY . .
EXPOSE 3001
CMD [ "npm", "start" ]
=======
FROM node:14.1

WORKDIR /var/www/

COPY ./src /var/www/src/
COPY ./index.js /var/www/
COPY ./*.json /var/www/

RUN npm install

RUN npm install pm2 -g

CMD ["pm2-runtime", "/var/www/index.js"]
>>>>>>> master
