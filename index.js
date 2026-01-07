const dns2 = require('dns2');

const { Packet } = dns2;

const options = {
  nameServers: ['8.8.8.8'],
  port: 53,
  timeout: 2000,
  retries: 2,
};


const { UDPClient } = require('dns2');
const upstreamDNS = UDPClient(options);

const server = dns2.createServer({
  udp: true,
  tcp: true,
  handle: async (request, send, rinfo) => {
    try {
      console.log(request);
      const response = await upstreamDNS(request.packet);
      console.log(response)
      const originalId = request.header.id
      response.header.id = originalId;
      response.header.ra = 1;
      send(response);
    } catch (err) {
      const failure = Packet.createResponseFromRequest(request);
      console.log(failure);
      console.log(err);
      failure.header.rcode = 2;
      send(failure);
    }
  },
});

server.on('request', (request, response, rinfo) => {
  console.log(request.header.id, request.questions[0]);
});

server.on('requestError', (error) => {
  console.log('Client sent an invalid request', error);
});

server.on('listening', () => {
  console.log(server.addresses());
});

server.on('close', () => {
  console.log('server closed');
});

server.listen({
  udp: { 
    port: 53,
    address: "127.0.0.1",
    type: "udp4",
  },
  
  tcp: { 
    port: 53,
    address: "127.0.0.1",
  },
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received.');
  server.close();
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received.');
  server.close();
});