// focusDNS with dns2
const { UDPServer, Packet } = require("dns2");
const readline = require("readline");
const express = require("express");

const UPSTREAM_DNS = "8.8.8.8";
const DNS_PORT = 53;
const HTTP_PORT = 8080;
const REPLY_PRECURSOR = ">>> ";

let blockedDomains = ["youtube.com", "reddit.com"];
let blocking = false;
let blockTimeout = null;
let webEnabled = false;
let webServer = null;

// Helper: check if domain or any parent matches blocked list
function isBlocked(domain) {
  const d = domain.toLowerCase();
  return blockedDomains.some(b => d === b || d.endsWith("." + b));
}

// DNS server
const server = new UDPServer({
  type: "udp4",
  handle: async (request, send) => {
    const [question] = request.questions;
    if (!question) return;

    const qname = question.name;

    if (blocking && isBlocked(qname)) {
      // respond NXDOMAIN
      const response = Packet.createResponseFromRequest(request);
      response.header.rcode = Packet.RCODE.NXDOMAIN;
      send(response);
      return;
    }

    try {
      // Forward upstream
      const response = await Packet.createClient({ dns: UPSTREAM_DNS }).resolve(qname, question.type);
      send(response);
    } catch (e) {
      console.error("Upstream DNS error", e);
      const response = Packet.createResponseFromRequest(request);
      response.header.rcode = Packet.RCODE.SERVFAIL;
      send(response);
    }
  },
});

server.listen({ port: DNS_PORT, address: "127.0.0.1" }, () => {
  console.log(REPLY_PRECURSOR + `DNS server listening on 127.0.0.1:${DNS_PORT}\n`);
});

// HTTP server
function enableWeb() {
  if (!webEnabled) {
    const app = express();
    app.use(express.json());
    app.post("/start", (req, res) => { blocking = true; res.sendStatus(200); });
    app.post("/stop", (req, res) => { blocking = false; res.sendStatus(200); });
    app.post("/start_for", (req, res) => {
      const sec = parseInt(req.query.seconds || "0");
      blocking = true;
      if (blockTimeout) clearTimeout(blockTimeout);
      blockTimeout = setTimeout(() => blocking = false, sec*1000);
      res.sendStatus(200);
    });
    webServer = app.listen(HTTP_PORT, () => console.log(REPLY_PRECURSOR + `HTTP API listening on ${HTTP_PORT}`));
    webEnabled = true;
  }
}

function disableWeb() {
  if (webEnabled && webServer) {
    webServer.close();
    webEnabled = false;
  }
}

// CLI
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt() {
  rl.question("", async line => {
    const parts = line.trim().split(/\s+/);
    switch (parts[0]) {
      case "web_enable": enableWeb(); break;
      case "web_disable": disableWeb(); break;
      case "blocking_enable":
        blocking = true;
        console.log(REPLY_PRECURSOR + "Blocking Enabled");
        break;
      case "blocking_disable":
        blocking = false;
        console.log(REPLY_PRECURSOR + "Blocking Disabled");
        break;
      case "blocking_enable_for":
        const sec = parseInt(parts[1]);
        blocking = true;
        if (blockTimeout) clearTimeout(blockTimeout);
        blockTimeout = setTimeout(() => blocking = false, sec*1000);
        console.log(REPLY_PRECURSOR + "Blocking Enabled for " + sec + " seconds");
        break;
      case "status":
        console.log("");
        console.log(REPLY_PRECURSOR + "DNS listening on 127.0.0.1:" + DNS_PORT);
        console.log(REPLY_PRECURSOR + "Upstream DNS:", UPSTREAM_DNS);
        console.log(REPLY_PRECURSOR + "HTTP enabled:", webEnabled);
        console.log(REPLY_PRECURSOR + "Blocking active:", blocking);
        console.log(REPLY_PRECURSOR + "Blocked domains:", blockedDomains.join(", "));
        console.log("");
        break;
      default: break;
    }
    prompt();
  });
}

prompt();
