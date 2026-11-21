import type { HttpClient } from "../http.js";

export abstract class Resource {
  constructor(protected readonly http: HttpClient) {}
}
