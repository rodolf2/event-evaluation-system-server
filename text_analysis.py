#!/usr/bin/env python3
"""
Text Analysis Module using TextBlob for Sentiment Analysis
Aligned with La Verdad Christian College Capstone Project Requirements
Supports both English and Tagalog/Filipino languages
"""

import sys
import json
import re
from textblob import TextBlob
import pandas as pd
from typing import Dict, List, Tuple

# Tagalog/Filipino sentiment lexicon
TAGALOG_SENTIMENT_WORDS = {
    # Positive words
    'maganda': 0.8, 'ganda': 0.7, 'magaling': 0.9, 'galing': 0.8,
    'masaya': 0.9, 'saya': 0.8, 'masarap': 0.7, 'sarap': 0.6,
    'maayos': 0.6, 'ayos': 0.5, 'mabuti': 0.8, 'buti': 0.7,
    'napakaganda': 0.9, 'napakabuti': 0.9, 'napakagaling': 0.9,
    'gustong': 0.6, 'gusto': 0.7, 'nais': 0.5, 'kaya': 0.4,
    'alam': 0.3, 'marunong': 0.6, 'talented': 0.8, 'skilled': 0.7,
    'excellent': 0.9, 'great': 0.8, 'good': 0.7, 'nice': 0.6,
    'love': 0.8, 'like': 0.6, 'enjoy': 0.7, 'happy': 0.8,
    'awesome': 0.9, 'amazing': 0.9, 'wonderful': 0.8, 'fantastic': 0.9,

    # Negative words
    'pangit': -0.8, 'panget': -0.7, 'masama': -0.8, 'sama': -0.7,
    'malungkot': -0.7, 'lungkot': -0.6, 'sakit': -0.6, 'masakit': -0.7,
    'ayaw': -0.6, 'hindi': -0.4, 'di': -0.3, 'walang': -0.5,
    'wala': -0.4, 'mahirap': -0.6, 'hirap': -0.5, 'pagod': -0.5,
    'galit': -0.8, 'angry': -0.8, 'bad': -0.7, 'poor': -0.6,
    'terrible': -0.9, 'awful': -0.8, 'hate': -0.8, 'dislike': -0.6,
    'worst': -0.9, 'ugly': -0.7, 'stupid': -0.8, 'boring': -0.6,

    # Intensifiers
    'napaka': 0.3, 'sobra': 0.2, 'talaga': 0.2, 'very': 0.3,
    'super': 0.4, 'ultra': 0.4, 'extremely': 0.4, 'highly': 0.3,
}

def detect_language(text: str) -> str:
    """
    Detect if text is primarily Tagalog/Filipino or English

    Args:
        text (str): The text to analyze

    Returns:
        str: 'tagalog', 'english', or 'mixed'
    """
    if not text:
        return 'english'

    words = re.findall(r'\b\w+\b', text.lower())

    tagalog_count = 0
    english_count = 0

    tagalog_indicators = {'ang', 'ng', 'na', 'sa', 'ay', 'si', 'ni', 'kay', 'at', 'o', 'pero', 'kasi', 'kung', 'dito', 'doon'}

    for word in words:
        if word in TAGALOG_SENTIMENT_WORDS:
            tagalog_count += 1
        elif word in tagalog_indicators:
            tagalog_count += 0.5
        elif word in {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were'}:
            english_count += 0.5
        else:
            # Check if word looks English (contains mostly Latin characters)
            if re.match(r'^[a-zA-Z]+$', word):
                english_count += 1

    if tagalog_count > english_count:
        return 'tagalog'
    elif english_count > tagalog_count:
        return 'english'
    else:
        return 'mixed'

def preprocess_text(text: str) -> str:
    """
    Preprocess text for better analysis, handling both English and Tagalog

    Args:
        text (str): Raw text input

    Returns:
        str: Preprocessed text
    """
    if not text:
        return ""

    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text.strip())

    # Handle common Filipino text patterns
    text = re.sub(r'(\w+)(\.|\?|\!)(\w+)', r'\1 \3', text)  # Split words connected by punctuation

    return text

def analyze_sentiment_enhanced(text: str) -> Dict[str, float]:
    """
    Enhanced sentiment analysis supporting both English and Tagalog

    Args:
        text (str): The text to analyze

    Returns:
        Dict containing polarity and subjectivity scores
    """
    if not text or not text.strip():
        return {'polarity': 50.0, 'subjectivity': 50.0}

    text = preprocess_text(text)

    # Detect language
    language = detect_language(text)

    # Use TextBlob for English text
    if language == 'english':
        blob = TextBlob(text)
        polarity = (blob.sentiment.polarity + 1) * 50
        subjectivity = blob.sentiment.subjectivity * 100

    # Enhanced analysis for Tagalog/Mixed text
    else:
        # Manual sentiment calculation for Tagalog words
        words = re.findall(r'\b\w+\b', text.lower())
        sentiment_scores = []

        for word in words:
            if word in TAGALOG_SENTIMENT_WORDS:
                base_score = TAGALOG_SENTIMENT_WORDS[word]

                # Apply intensifiers
                word_index = words.index(word)
                if word_index > 0:
                    prev_word = words[word_index - 1]
                    if prev_word in ['napaka', 'sobra', 'talaga', 'very', 'super', 'extremely']:
                        base_score *= 1.3  # Increase intensity
                    elif prev_word in ['medyo', 'konting', 'kaunti', 'somewhat']:
                        base_score *= 0.7  # Decrease intensity

                sentiment_scores.append(base_score)

        if sentiment_scores:
            # Average the sentiment scores
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
            polarity = (avg_sentiment + 1) * 50  # Convert -1,1 to 0,100

            # Estimate subjectivity based on sentiment intensity
            subjectivity = min(100, abs(avg_sentiment) * 100 + 30)
        else:
            # Fallback to TextBlob if no Tagalog words found
            blob = TextBlob(text)
            polarity = (blob.sentiment.polarity + 1) * 50
            subjectivity = blob.sentiment.subjectivity * 100

    return {
        'polarity': max(0, min(100, polarity)),  # Clamp to 0-100
        'subjectivity': max(0, min(100, subjectivity)),  # Clamp to 0-100
        'language': language
    }

def analyze_sentiment(text: str) -> Dict[str, float]:
    """
    Analyze sentiment of a single text using enhanced multilingual analysis

    Args:
        text (str): The text to analyze

    Returns:
        Dict containing polarity and subjectivity scores
    """
    return analyze_sentiment_enhanced(text)

def categorize_sentiment_score(score: float) -> str:
    """
    Categorize sentiment score into positive, neutral, or negative

    Args:
        score (float): Sentiment score from 0-100

    Returns:
        str: 'positive', 'neutral', or 'negative'
    """
    if score > 60:
        return 'positive'
    elif score < 40:
        return 'negative'
    else:
        return 'neutral'

def analyze_feedback_batch(feedbacks: List[str]) -> Dict:
    """
    Analyze a batch of feedback texts

    Args:
        feedbacks (List[str]): List of feedback texts

    Returns:
        Dict containing analysis results
    """
    results = {
        'summary': {'positive': 0, 'neutral': 0, 'negative': 0},
        'comments': {'positive': [], 'neutral': [], 'negative': []},
        'details': []
    }

    for feedback in feedbacks:
        if not feedback or not isinstance(feedback, str):
            continue

        sentiment_result = analyze_sentiment(feedback)

        # Determine category based on polarity score
        category = categorize_sentiment_score(sentiment_result['polarity'])

        results['summary'][category] += 1
        results['comments'][category].append(feedback)

        results['details'].append({
            'text': feedback,
            'polarity': sentiment_result['polarity'],
            'subjectivity': sentiment_result['subjectivity'],
            'language': sentiment_result.get('language', 'english'),
            'category': category
        })

    return results

def generate_insights_and_recommendations(analysis_result: Dict) -> Tuple[str, str]:
    """
    Generate insights and recommendations based on analysis results

    Args:
        analysis_result (Dict): Results from analyze_feedback_batch

    Returns:
        Tuple of (insights, recommendations)
    """
    total = sum(analysis_result['summary'].values())
    positive_count = analysis_result['summary']['positive']

    if total == 0:
        return (
            "No feedback available to generate insights.",
            "Encourage participants to provide feedback."
        )

    positive_percentage = (positive_count / total) * 100

    if positive_percentage > 70:
        insights = "The event was very well-received by the participants."
        recommendations = "Continue with the current event format and focus on minor improvements."
    elif positive_percentage > 40:
        insights = "The event received mixed feedback."
        recommendations = "Review the negative feedback to identify areas for improvement."
    else:
        insights = "The event did not meet participant expectations."
        recommendations = "A thorough review of the event planning and execution is recommended."

    return insights, recommendations

def generate_qualitative_report(feedbacks: List[str]) -> Dict:
    """
    Generate a complete qualitative report

    Args:
        feedbacks (List[str]): List of feedback texts

    Returns:
        Dict containing the complete report
    """
    if not feedbacks:
        return {
            'summary': {'positive': 0, 'neutral': 0, 'negative': 0},
            'insights': 'No feedback available to generate insights.',
            'recommendations': 'Encourage participants to provide feedback.',
            'comments': {'positive': [], 'neutral': [], 'negative': []},
        }

    analysis_result = analyze_feedback_batch(feedbacks)
    insights, recommendations = generate_insights_and_recommendations(analysis_result)

    return {
        'summary': analysis_result['summary'],
        'insights': insights,
        'recommendations': recommendations,
        'comments': analysis_result['comments'],
    }

def analyze_quantitative_data(current_data, previous_data, current_year, previous_year):
    """
    Analyze quantitative data using pandas for statistical analysis

    Args:
        current_data (dict): Current year data with ratings and response count
        previous_data (dict): Previous year data with ratings and response count
        current_year (int): Current year
        previous_year (int): Previous year

    Returns:
        dict: Quantitative analysis results
    """
    import pandas as pd
    import numpy as np

    # Create DataFrames for analysis
    current_df = pd.DataFrame({'rating': current_data['ratings']}) if current_data['ratings'] else pd.DataFrame({'rating': []})
    previous_df = pd.DataFrame({'rating': previous_data['ratings']}) if previous_data['ratings'] else pd.DataFrame({'rating': []})

    # Calculate statistics for current year
    current_stats = {
        'averageRating': float(current_df['rating'].mean()) if not current_df.empty else 0,
        'responseCount': current_data['responseCount']
    }

    # Calculate statistics for previous year
    previous_stats = {
        'averageRating': float(previous_df['rating'].mean()) if not previous_df.empty else 0,
        'responseCount': previous_data['responseCount']
    }

    # Calculate additional metrics if data is available
    if not current_df.empty:
        current_stats.update({
            'medianRating': float(current_df['rating'].median()),
            'minRating': float(current_df['rating'].min()),
            'maxRating': float(current_df['rating'].max()),
            'stdDev': float(current_df['rating'].std()) if len(current_df) > 1 else 0
        })

    if not previous_df.empty:
        previous_stats.update({
            'medianRating': float(previous_df['rating'].median()),
            'minRating': float(previous_df['rating'].min()),
            'maxRating': float(previous_df['rating'].max()),
            'stdDev': float(previous_df['rating'].std()) if len(previous_df) > 1 else 0
        })

    return {
        'currentYear': {
            'year': current_year,
            **current_stats
        },
        'previousYear': {
            'year': previous_year,
            **previous_stats
        }
    }

def main():
    """
    Main function to handle command line input/output
    """
    try:
        # Read JSON from command line argument
        if len(sys.argv) > 1:
            json_input = sys.argv[1]
        else:
            # Try to read from stdin if no argument provided
            json_input = sys.stdin.read().strip()

        if not json_input:
            print(json.dumps({'error': 'No input provided'}))
            sys.exit(1)

        input_data = json.loads(json_input)
        action = input_data.get('action')

        if action == 'analyze_single':
            text = input_data.get('text', '')
            result = analyze_sentiment(text)
            print(json.dumps(result))

        elif action == 'analyze_batch':
            feedbacks = input_data.get('feedbacks', [])
            result = analyze_feedback_batch(feedbacks)
            print(json.dumps(result))

        elif action == 'generate_report':
            feedbacks = input_data.get('feedbacks', [])
            result = generate_qualitative_report(feedbacks)
            print(json.dumps(result))

        elif action == 'analyze_quantitative':
            current_data = input_data.get('currentYearData', {'ratings': [], 'responseCount': 0})
            previous_data = input_data.get('previousYearData', {'ratings': [], 'responseCount': 0})
            current_year = input_data.get('currentYear', 2024)
            previous_year = input_data.get('previousYear', 2023)
            result = analyze_quantitative_data(current_data, previous_data, current_year, previous_year)
            print(json.dumps(result))

        else:
            print(json.dumps({'error': 'Invalid action'}))

    except json.JSONDecodeError as e:
        print(json.dumps({'error': f'Invalid JSON input: {str(e)}'}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

if __name__ == "__main__":
    main()