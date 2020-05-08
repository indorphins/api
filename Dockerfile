FROM node:14.1

WORKDIR /var/www/

COPY ./src /var/www/src/
COPY ./index.js /var/www/
COPY ./*.json /var/www/

RUN npm install

RUN npm install pm2 -g

CMD ["pm2-runtime", "/var/www/index.js"]
