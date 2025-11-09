import { describe, it, expect } from '@jest/globals';

import { decodeBase64File } from '../src/services/tenant-assets.service.js';

describe('tenant-assets.service decodeBase64File', () => {
  it('decodes base64 payload with mime prefix', () => {
    const sample = 'data:text/plain;base64,SG9sYSBNT1U=';
    const { buffer, mimeType } = decodeBase64File(sample);
    expect(mimeType).toBe('text/plain');
    expect(buffer.toString()).toBe('Hola MOU');
  });

  it('decodes raw base64 payload without mime', () => {
    const sample = Buffer.from('archivo binario').toString('base64');
    const { buffer, mimeType } = decodeBase64File(sample);
    expect(mimeType).toBe('application/octet-stream');
    expect(buffer.toString()).toBe('archivo binario');
  });
});


