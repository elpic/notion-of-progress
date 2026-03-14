import { Client } from '@notionhq/client';
import { config } from '../config/index.js';

let _client: Client | null = null;

export function getNotionClient(): Client {
  if (!_client) {
    _client = new Client({ auth: config.notion.apiKey });
  }
  return _client;
}
