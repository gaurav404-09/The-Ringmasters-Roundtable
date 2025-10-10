import sys
import json
import argparse
import re

def simple_sentiment_analysis(text):
    """
    Simple rule-based sentiment analysis
    """
    # Expanded word lists for better accuracy
    positive_words = [
        'love', 'amazing', 'great', 'awesome', 'fantastic', 'wonderful', 'excellent', 
        'good', 'best', 'beautiful', 'perfect', 'incredible', 'outstanding', 'brilliant', 
        'superb', 'magnificent', 'marvelous', 'terrific', 'fabulous', 'delightful',
        'enjoy', 'enjoyed', 'happy', 'pleased', 'satisfied', 'impressed', 'recommend',
        'loved', 'adore', 'spectacular', 'breathtaking', 'stunning', 'gorgeous',
        'nice', 'pleasant', 'comfortable', 'relaxing', 'peaceful', 'fun', 'exciting'
    ]
    
    negative_words = [
        'hate', 'terrible', 'awful', 'bad', 'worst', 'horrible', 'disgusting', 
        'pathetic', 'useless', 'disappointing', 'annoying', 'frustrating', 'boring', 
        'stupid', 'ridiculous', 'waste', 'regret', 'poor', 'cheap', 'fake',
        'dislike', 'disliked', 'unhappy', 'unsatisfied', 'unimpressed', 'avoid',
        'hated', 'despise', 'unpleasant', 'uncomfortable', 'stressful', 'chaotic',
        'overpriced', 'expensive', 'dirty', 'noisy', 'crowded', 'rude'
    ]
    
    # Convert to lowercase and split into words
    text_lower = text.lower()
    words = re.findall(r'\b\w+\b', text_lower)
    
    # Count positive and negative words
    positive_count = sum(1 for word in words if word in positive_words)
    negative_count = sum(1 for word in words if word in negative_words)
    
    # Calculate sentiment
    if positive_count > negative_count:
        # More positive words
        confidence = min(0.9, 0.6 + (positive_count - negative_count) * 0.1)
        return 1, confidence  # positive
    elif negative_count > positive_count:
        # More negative words
        confidence = min(0.9, 0.6 + (negative_count - positive_count) * 0.1)
        return -1, confidence  # negative
    else:
        # Equal or no sentiment words
        return 0, 0.5  # neutral

def predict_sentiment(text):
    """
    Predict sentiment for a single text
    """
    if not text or text.strip() == '':
        return {'prediction': 0, 'confidence': 0.5}
    
    prediction, confidence = simple_sentiment_analysis(text)
    return {'prediction': prediction, 'confidence': confidence}

def predict_batch(texts):
    """
    Predict sentiment for multiple texts
    """
    results = []
    for text in texts:
        result = predict_sentiment(text)
        results.append(result)
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Simple Sentiment Analysis')
    parser.add_argument('--text', type=str, help='Text to analyze')
    parser.add_argument('--batch', type=str, help='JSON array of texts to analyze')
    
    args = parser.parse_args()
    
    if args.text:
        # Single text prediction
        result = predict_sentiment(args.text)
        print(json.dumps(result))
    elif args.batch:
        # Batch prediction
        try:
            texts = json.loads(args.batch)
            results = predict_batch(texts)
            print(json.dumps(results))
        except json.JSONDecodeError:
            print(json.dumps({'error': 'Invalid JSON format'}))
    else:
        print(json.dumps({'error': 'No text provided'}))
