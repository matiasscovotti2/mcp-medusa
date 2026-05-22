import dotenv from 'dotenv';
import { corsHeaders } from '../lib/auth.js';
import { getAuthorizationServerMetadata } from '../lib/oauth.js';

dotenv.config();

export default function handler(req, res) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json(getAuthorizationServerMetadata(req));
}
