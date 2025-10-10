import sys
import os
import json
import argparse
import re
import pandas as pd
import pickle
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import PorterStemmer

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
        try:
            # Transform text using vectorizer
            text_vectorized = vectorizer.transform([processed_text])
            
            # Scale the features
            text_scaled = scaler.transform(text_vectorized.toarray())
            
            # Make prediction
            prediction = model.predict(text_scaled)[0]
            
            # Get prediction probability for confidence
            try:
                probabilities = model.predict_proba(text_scaled)[0]
                confidence = max(probabilities)
            except:
                confidence = 0.7  # Default confidence if predict_proba is not available
            
            return {'prediction': prediction, 'confidence': confidence}
        except Exception as e:
            print(f"ML model prediction failed: {e}", file=sys.stderr)
            # Fall back to simple analysis
            pass
    
    # Fallback to simple sentiment analysis
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
            print(json.dumps({'error': 'Invalid JSON format'}))
    else:
        print(json.dumps({'error': 'No text provided'}))
