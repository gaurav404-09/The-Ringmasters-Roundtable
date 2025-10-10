# Sentiment Analysis Integration

This directory contains the sentiment analysis functionality for The Ringmasters Roundtable community platform.

## Overview

The sentiment analysis system automatically analyzes community posts and comments to classify them as positive, negative, or neutral. This helps users filter content and provides insights into community sentiment.

## Components

### Python Scripts
- **`main.py`**: Core sentiment analysis script that loads trained models and processes text
- **`api.py`**: Flask API wrapper for the sentiment analysis (optional)

### Models
- **`model_xgb.pkl`**: Trained XGBoost classifier
- **`model_dt.pkl`**: Trained Decision Tree classifier (backup)
- **`model_rf.pkl`**: Trained Random Forest classifier (backup)
- **`countVectorizer.pkl`**: Text vectorizer for feature extraction
- **`scaler.pkl`**: Feature scaler for normalization

### Templates
- **`index.html`**: Basic web interface for testing
- **`landing.html`**: Enhanced web interface with styling

## Installation

1. Install Python dependencies:
```bash
cd backend/sentiment
pip install -r requirements.txt
```

2. The system will automatically download required NLTK data on first run.

## Usage

### Command Line Interface

Analyze a single text:
```bash
python main.py --text "I love this place! Amazing experience."
```

Analyze multiple texts:
```bash
python main.py --batch '["Great service!", "Terrible food", "It was okay"]'
```

### Node.js Integration

The sentiment analysis is automatically integrated into the community system:

1. **Post Creation**: When users create posts, sentiment is analyzed and stored
2. **Comment Creation**: When users add comments, sentiment is analyzed and stored
3. **Filtering**: Users can filter posts by sentiment (positive/negative/neutral)
4. **Statistics**: Real-time sentiment statistics are displayed

### API Endpoints

- `GET /api/community/posts?sentiment=positive` - Filter posts by sentiment
- `GET /api/community/sentiment/stats` - Get sentiment statistics

## Frontend Features

### Post Display
- Sentiment badges on community post cards
- Color-coded sentiment indicators (green=positive, red=negative, gray=neutral)
- Confidence percentage display

### Filtering
- Sentiment filter buttons in the community interface
- Real-time filtering by sentiment type

### Statistics
- Sentiment distribution charts
- Confidence metrics
- Filter-specific statistics

## Technical Details

### Text Preprocessing
1. Convert to lowercase
2. Remove special characters and digits
3. Tokenize using NLTK
4. Remove stopwords
5. Apply stemming

### Model Pipeline
1. Text preprocessing
2. Vectorization using CountVectorizer
3. Feature scaling using MinMaxScaler
4. Classification using XGBoost
5. Confidence calculation using prediction probabilities

### Error Handling
- Graceful fallback to neutral sentiment on errors
- Automatic retry mechanisms
- Logging of analysis failures

## Configuration

### Environment Variables
- `PYTHON_PATH`: Path to Python executable (optional)
- `SENTIMENT_MODEL_PATH`: Custom path to model files (optional)

### Model Selection
The system uses XGBoost by default but can fall back to other models if needed.

## Performance

- Average processing time: ~100ms per text
- Batch processing supported for efficiency
- Asynchronous processing in Node.js backend

## Monitoring

- Sentiment analysis success/failure rates logged
- Performance metrics tracked
- Model confidence scores monitored

## Troubleshooting

### Common Issues

1. **Model files not found**: Ensure all `.pkl` files are in the `Models/` directory
2. **NLTK data missing**: Run the script once to auto-download required data
3. **Python not found**: Check Python installation and PATH
4. **Memory issues**: Consider batch size limits for large datasets

### Logs
Check Node.js console for sentiment analysis errors and performance metrics.

## Future Enhancements

- Real-time sentiment monitoring dashboard
- Sentiment trend analysis over time
- Advanced emotion detection (joy, anger, fear, etc.)
- Multi-language sentiment analysis
- Custom model training interface
