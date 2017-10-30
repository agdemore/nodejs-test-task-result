"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const mime = require("mime");
const winston = require("winston");
const moment = require("moment");

const NEWS_URL = "http://slowpoke.desigens.com/json/1/7000";
const PHRASE_URL = "http://slowpoke.desigens.com/json/2/3000";
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const LOGFILE = path.join(__dirname, "errors.log");

const logger = new winston.Logger({
  transports: [
    new winston.transports.File({ filename: LOGFILE })
  ]
});

function requestPromise(url, timeout) {
  return new Promise((resolve, reject) => {
    let request = http.get(url, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });
      
      res.on("end", () => {
        resolve(data);
      });
    });
    request.on("error", (error) => {
      reject(error.message);
    });
    request.on("timeout", () => {
    });

    request.setTimeout(timeout, () => {
      request.abort(); 
    });
  });  
};

http.createServer(async (req, res) => {
  if (req.url !== "/") {
    //request some static files
    let pathname = path.normalize(__dirname + req.url);
    fs.stat(pathname, (error, stats) => {
      if (error) {
        res.writeHead(404);
        res.write("Resource missing");
        res.end();
      } else if (stats.isFile()) {
        let type = mime.getType(pathname);

        let file = fs.createReadStream(pathname);
        file.on("open", () => {
          res.setHeader("Content-Type", type);
          res.statusCode = 200;
          file.pipe(res);
        });
        file.on("error", (error) => {
          res.statusCode = 403;
          res.write("wrong file pernission");
          res.end();
        });
      } else {
        res.writeHead(403);
        res.write("access forbidden");
        res.end();
      }
    });
  } else {
    fs.readFile(TEMPLATE_PATH, "utf-8", async (error, source) => {
      if (error) {
        res.writeHead(404);
        res.write("file not exist");
        res.end();
      } else {
        
        let news;
        let phrases;
        let newsRequest = requestPromise(NEWS_URL, 6000);
        let phrasesRequest = requestPromise(PHRASE_URL, 6000);

        try {
          news = JSON.parse(await newsRequest);
        } catch (error) {
          console.log("no news", error);
          logger.error("no news");
        }
        try {
          phrases = JSON.parse(await phrasesRequest);
        } catch (error) {
          console.log("no phrases", error);
          logger.error("no phrases");
        }

        const data = {news, phrases};

        res.setHeader("Content-Type", "text/html");

        handlebars.registerHelper("custom_date", (date) => {
          moment.locale("ru"); 
          return moment(date).format('LL');
        });
        
        handlebars.registerHelper("bold_phrase", (phrase) => {
          let words = phrase.split(" ");
          for (let i = 0, n = words.length; i < n; i++) {
            if (words[i] === "привет" || words[i] === "privet") {
              words[i] = `<b>${words[i]}</b>`;
            }
          }
          phrase = words.join(" ");
          return new handlebars.SafeString(phrase);
        });

        let template = handlebars.compile(source);
        let html = template(data);
        res.statusCode = 200;
        res.write(html);
        res.end();
      }
    });
  }
}).listen(3000);

console.log("Server running on http://localhost:3000/");

