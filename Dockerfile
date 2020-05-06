FROM node:14.1

RUN mkdir /var/www

WORKDIR /var/www/

COPY ./src /var/www/src/
COPY ./index.js /var/www/
COPY ./*.json /var/www/

RUN npm install

CMD ["node", "/var/www/index.js"]