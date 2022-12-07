import * as util from "../util.js";
import type { Request, Warnings } from "../util.js";

import { repr as pyrepr } from "./python.js";

const supportedArgs = new Set([
  "url",
  "request",
  "compressed",
  "no-compressed",
  "data",
  "data-raw",
  "data-ascii",
  "data-binary",
  "data-urlencode",
  "json",
  "user-agent",
  "cookie",
  "range",
  "referer",
  "time-cond",
  // TODO
  // "form",
  // "form-string",
  "get",
  "header",
  "head",
  "no-head",
  "user",
  "basic",
  "no-basic",
  "oauth2-bearer",
  "max-time",
  "insecure",
  "no-insecure",
]);

const reprMaybeBacktick = (s: string): string => {
  return s.includes('"') ? reprBacktick(s) : repr(s);
};
const reprBacktick = (s: string): string => {
  return !s.includes("`") && !s.includes("\r") ? "`" + s + "`" : repr(s);
};
const repr = (s: string): string => {
  return pyrepr(s, '"');
};

export const _toGo = (request: Request, warnings: Warnings = []): string => {
  warnings = warnings || [];
  let goCode = "package main\n\n";

  goCode += "import (\n";
  goCode += '\t"fmt"\n';
  goCode += '\t"io/ioutil"\n';
  goCode += '\t"log"\n';
  goCode += '\t"net/http"\n';
  if (request.insecure) {
    goCode += '\t"crypto/tls"\n';
  }
  if (request.data) {
    goCode += '\t"strings"\n';
  }
  if (request.timeout) {
    goCode += '\t"time"\n';
  }
  goCode += ")\n\n";

  goCode += "func main() {\n";

  if (request.insecure) {
    goCode += "\ttr := &http.Transport{\n";
    goCode += "\t\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},\n";
    goCode += "\t}\n";
  }

  goCode += "\tclient := &http.Client{";
  if (request.timeout) {
    goCode += "\n";
    if (request.insecure) {
      goCode += "\t\tTransport: tr,\n";
    }
    if (request.timeout) {
      goCode += "\t\tTimeout: " + request.timeout + " * time.Second,\n";
    }
    goCode += "\t";
  } else if (request.insecure) {
    goCode += "Transport: tr";
  }
  goCode += "}\n";

  if (request.data) {
    goCode +=
      "\tvar data = strings.NewReader(" + reprBacktick(request.data) + ")\n";
  }

  goCode +=
    "\treq, err := http.NewRequest(" +
    repr(request.method) +
    ", " +
    repr(request.url);
  goCode += ", " + (request.data ? "data" : "nil") + ")\n";
  goCode += "\tif err != nil {\n";
  goCode += "\t\tlog.Fatal(err)\n";
  goCode += "\t}\n";

  if (request.headers) {
    for (const [headerName, headerValue] of request.headers || []) {
      goCode +=
        "\treq.Header.Set(" +
        repr(headerName) +
        ", " +
        reprMaybeBacktick(headerValue ?? "") +
        ")\n";
    }
  }

  if (request.auth && request.authType === "basic") {
    const [user, password] = request.auth;
    goCode +=
      "\treq.SetBasicAuth(" + repr(user) + ", " + repr(password) + ")\n";
  }

  goCode += "\tresp, err := client.Do(req)\n";
  goCode += "\tif err != nil {\n";
  goCode += "\t\tlog.Fatal(err)\n";
  goCode += "\t}\n";
  goCode += "\tdefer resp.Body.Close()\n";
  goCode += "\tbodyText, err := ioutil.ReadAll(resp.Body)\n";
  goCode += "\tif err != nil {\n";
  goCode += "\t\tlog.Fatal(err)\n";
  goCode += "\t}\n";
  goCode += '\tfmt.Printf("%s\\n", bodyText)\n';
  goCode += "}";

  return goCode + "\n";
};
export const toGoWarn = (
  curlCommand: string | string[],
  warnings: Warnings = []
): [string, Warnings] => {
  const request = util.parseCurlCommand(curlCommand, supportedArgs, warnings);
  const go = _toGo(request, warnings);
  return [go, warnings];
};
export const toGo = (curlCommand: string | string[]): string => {
  return toGoWarn(curlCommand)[0];
};
