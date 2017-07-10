FROM node:6-alpine

RUN mkdir -p /usr/airscape-mqtt-bridge
COPY . /usr/airscape-mqtt-bridge
WORKDIR /usr/airscape-mqtt-bridge
RUN npm install --production

CMD ["npm", "start"]
