import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockClient = {
  chat: {
    completions: {
      create: jest.fn()
    }
  }
};

const { generateAiEvaluation, __setOpenAiClient } = await import('../src/services/evaluation-ai.service.js');

describe('evaluation-ai.service', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    mockClient.chat.completions.create.mockReset();
    __setOpenAiClient(mockClient);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    __setOpenAiClient(null);
  });

  it('parses OpenAI response and returns structured result', async () => {
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              overallScore: 82,
              overallFeedback: 'Buen trabajo',
              criteria: [
                { criterionId: 1, score: 80, feedback: 'Impacto sólido' }
              ]
            })
          }
        }
      ],
      usage: { total_tokens: 120 }
    });

    const result = await generateAiEvaluation({
      rubric: {
        id: 1,
        name: 'Demo rubric',
        description: '',
        scale_min: 0,
        scale_max: 100,
        criteria: [
          { id: 10, title: 'Impacto', description: '', weight: 1, max_score: 100, order_index: 1 }
        ]
      },
      submission: {
        content: 'Descripción de la solución',
        files: []
      },
      task: {
        title: 'Pitch',
        description: 'Presentación general'
      },
      locale: 'es-ES'
    });

    expect(result.overallScore).toBe(82);
    expect(result.criteria).toHaveLength(1);
    expect(result.criteria[0].criterionId).toBe(1);
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('throws when OpenAI returns invalid JSON', async () => {
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'no-json'
          }
        }
      ],
      usage: {}
    });

    await expect(
      generateAiEvaluation({
        rubric: {
          id: 1,
          name: 'Demo rubric',
          description: '',
          scale_min: 0,
          scale_max: 100,
          criteria: [
            { id: 10, title: 'Impacto', description: '', weight: 1, max_score: 100, order_index: 1 }
          ]
        },
        submission: { content: 'Test', files: [] },
        task: { title: 'Pitch', description: '' },
        locale: 'es-ES'
      })
    ).rejects.toThrow('JSON');
  });
});

