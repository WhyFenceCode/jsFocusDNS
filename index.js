const dns2 = require('dns2');
const dgram = require("dgram");

const { Packet } = dns2;

const upstreamHost = '8.8.8.8';

function sendDnsPacket(packetBuffer, upstreamPort = 53) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");

    socket.once("message", (msg) => {
      socket.close();
      resolve(msg);
    });

    socket.once("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.send(packetBuffer, upstreamPort, upstreamHost, (err) => {
      if (err) {
        socket.close();
        reject(err);
      }
    });
  });
}

const server = dns2.createServer({
  udp: true,
  tcp: true,
  handle: async (request, send, rinfo) => {
    try {
      const packet = request.toBuffer();
      const response = await sendDnsPacket(packet);      
      send(response);
    } catch (err) {
      const failure = Packet.createResponseFromRequest(request);
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