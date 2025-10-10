import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the sentiment analysis Python script
const SENTIMENT_SCRIPT_PATH = path.join(__dirname, '../sentiment/main.py');

/**
 * Analyze sentiment of text using the trained model
 * @param {string} text - Text to analyze
 * @returns {Promise<{sentiment: string, confidence: number}>}
 */
export const analyzeSentiment = async (text) => {
  return new Promise((resolve) => {
    const sentimentDir = path.join(__dirname, '../sentiment');
    const scriptPath = path.join(sentimentDir, 'simple_sentiment.py');
    const escapedText = text.trim().replace(/"/g, '\\"').replace(/\n/g, '\\n');

    const python = spawn('python', [scriptPath, '--text', escapedText], {
      cwd: sentimentDir,
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Sentiment analysis error - exit code:', code, 'stderr:', stderr);
        return resolve({ sentiment: 'neutral', confidence: 0.5 });
      }

      try {
        const cleanOutput = stdout.trim();
        const result = JSON.parse(cleanOutput);
        
        const sentimentMap = {
          1: 'positive',
          0: 'neutral',
          '-1': 'negative',
          [-1]: 'negative'
        };
        
        const finalResult = {
          sentiment: sentimentMap[result.prediction] || 'neutral',
          confidence: result.confidence || 0.5
        };
        
        resolve(finalResult);
      } catch (error) {
        console.error('Error parsing sentiment analysis result:', error);
        console.error('Raw stdout was:', stdout);
        resolve({ sentiment: 'neutral', confidence: 0.5 });
      }
    });

    python.on('error', (error) => {
      console.error('Failed to start sentiment analysis:', error);
      resolve({ sentiment: 'neutral', confidence: 0.5 });
    });
  });
};

/**
 * Analyze sentiment of multiple texts in batch
 * @param {string[]} texts - Array of texts to analyze
 * @returns {Promise<Array<{sentiment: string, confidence: number}>>}
 */
export const analyzeSentimentBatch = async (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const sentimentDir = path.join(__dirname, '../sentiment');
  const escapedText = texts.map(text => text.trim().replace(/"/g, '\\"').replace(/\n/g, '\\n')).join('\n');

  try {
    const result = await execAsync(`python "${path.join(sentimentDir, 'simple_sentiment.py')}" --text "${escapedText}"`, {
      cwd: sentimentDir,
      timeout: 10000,
    });
    return result.split('\n').map(line => {
      const [sentiment, confidence] = line.split(',');
      return {
        sentiment,
        confidence: parseFloat(confidence) || 0.5
      };
    });
  } catch (error) {
    console.error('Batch sentiment analysis error:', error);
    return texts.map(() => ({ sentiment: 'neutral', confidence: 0.5 }));
  }
};

/**
 * Get sentiment statistics for an array of sentiment results
 * @param {Array<{sentiment: string, confidence: number}>} sentiments
 * @returns {Object} Statistics object
 */
export const getSentimentStats = (sentiments) => {
  if (!Array.isArray(sentiments) || sentiments.length === 0) {
    return {
      total: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      positivePercentage: 0,
      negativePercentage: 0,
      neutralPercentage: 0,
      averageConfidence: 0
    };
  }

  const stats = sentiments.reduce((acc, item) => {
    acc.total++;
    acc[item.sentiment]++;
    acc.totalConfidence += item.confidence;
    return acc;
  }, {
    total: 0,
    positive: 0,
    negative: 0,
    neutral: 0,
    totalConfidence: 0
  });

  return {
    ...stats,
    positivePercentage: Math.round((stats.positive / stats.total) * 100),
    negativePercentage: Math.round((stats.negative / stats.total) * 100),
    neutralPercentage: Math.round((stats.neutral / stats.total) * 100),
    averageConfidence: stats.totalConfidence / stats.total
  };
};
