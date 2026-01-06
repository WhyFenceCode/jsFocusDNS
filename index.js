const dns2 = require('dns2');

const { Packet } = dns2;

const resolveUpstream = new dns2({
  dns: '8.8.8.8',
  port: 53,
  timeout: 2000,
  retries: 1,
});

const server = dns2.createServer({
  udp: true,
  tcp: true,
  handle: async (request, send, rinfo) => {
    try {
      const response = await resolveUpstream(request);
      response.header.ra = 1;
      send(response);
    } catch (err) {
      const failure = Packet.createResponseFromRequest(request);
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