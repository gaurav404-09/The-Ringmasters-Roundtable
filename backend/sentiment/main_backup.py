import pandas as pd
import numpy as np
import pickle
import json
import sys
import argparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MinMaxScaler
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer
import re
import warnings
import os
warnings.filterwarnings('ignore')

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

# Load the trained models and preprocessors
model = None
scaler = None
vectorizer = None

try:
    with open(os.path.join(script_dir, 'Models/model_xgb.pkl'), 'rb') as f:
        model = pickle.load(f)

    with open(os.path.join(script_dir, 'Models/scaler.pkl'), 'rb') as f:
        scaler = pickle.load(f)

    with open(os.path.join(script_dir, 'Models/countVectorizer.pkl'), 'rb') as f:
        vectorizer = pickle.load(f)
    
    print("Models loaded successfully", file=sys.stderr)
except Exception as e:
    print(f"Warning: Could not load models ({e}). Using fallback sentiment analysis.", file=sys.stderr)
    model = None

def preprocess_text(text):
    """
    Preprocess text for sentiment analysis
    """
    if pd.isna(text) or text == '':
        return ''
    
    # Convert to lowercase
    text = str(text).lower()
    
    # Remove special characters and digits
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    
    # Tokenize
    tokens = word_tokenize(text)
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [token for token in tokens if token not in stop_words]
    
    stemmer = PorterStemmer()
    tokens = [stemmer.stem(token) for token in tokens]
    
    return ' '.join(tokens)

def simple_sentiment_analysis(text):
    """
    Simple rule-based sentiment analysis as fallback
    """
    positive_words = ['love', 'amazing', 'great', 'awesome', 'fantastic', 'wonderful', 'excellent', 'good', 'best', 'beautiful', 'perfect', 'incredible', 'outstanding', 'brilliant', 'superb', 'magnificent', 'marvelous', 'terrific', 'fabulous', 'delightful']
    negative_words = ['hate', 'terrible', 'awful', 'bad', 'worst', 'horrible', 'disgusting', 'pathetic', 'useless', 'disappointing', 'annoying', 'frustrating', 'boring', 'stupid', 'ridiculous', 'waste', 'regret', 'poor', 'cheap', 'fake']
    
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count > negative_count:
        return 1, 0.7  # positive
    elif negative_count > positive_count:
        return -1, 0.7  # negative
    else:
        return 0, 0.6  # neutral

def predict_sentiment(text):
    """
    Predict sentiment for a single text
    """
    # Preprocess the text
    processed_text = preprocess_text(text)
    
    if processed_text == '':
        return {'prediction': 0, 'confidence': 0.5}
    
    # Use ML model if available, otherwise use simple analysis
    if model is not None and scaler is not None and vectorizer is not None:
    results = []
    for text in texts:
        result = predict_sentiment(text)
        results.append(result)
    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Sentiment Analysis')
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
            print(json.dumps({'error': 'Invalid JSON format for batch input'}))
    else:
        # Example usage if no arguments provided
        sample_texts = [
            "I love this place! Amazing experience.",
            "This was terrible. Worst service ever.",
            "It was okay, nothing special."
        ]
        
        print("Sample predictions:")
        for i, text in enumerate(sample_texts):
            result = predict_sentiment(text)
            sentiment = "Positive" if result['prediction'] == 1 else "Negative"
            print(f"Text {i+1}: {text}")
            print(f"Sentiment: {sentiment} (Confidence: {result['confidence']:.2f})")
            print("-" * 50)
