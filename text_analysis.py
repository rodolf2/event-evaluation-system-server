#!/usr/bin/env python3
"""
Text Analysis Script for Event Evaluation System
Implements multilingual sentiment analysis for English and Tagalog/Filipino text
Uses TextBlob for advanced sentiment analysis with custom Tagalog lexicon
"""

import sys
import json
import traceback
from textblob import TextBlob
import langid

class MultilingualSentimentAnalyzer:
    def __init__(self):
        # Enhanced Tagalog sentiment lexicons with intensifiers
        self.tagalog_positive = {
            # Basic positive words
            'maganda': 1, 'mabuti': 1, 'masaya': 1, 'nakakatuwa': 1, 'galing': 1,
            'bilib': 1, 'ang ganda': 2, 'napakaganda': 2, 'sobrang ganda': 2,
            'napakagaling': 2, 'sobrang galing': 2, 'nakakaaliw': 1, 'nakakatuwa': 1,

            # Intensifiers
            'napaka': 1.5, 'sobra': 1.5, 'super': 1.5, 'very': 1.5, 'very much': 1.5,
            'labis': 1.5, 'lubos': 1.5, 'totoo': 1, 'talaga': 1,

            # Additional positive expressions
            'thank you': 1, 'salamat': 1, 'maraming salamat': 2, 'grateful': 1,
            'mahusay': 1, 'maayos': 1, 'mahusay ang': 1, 'effective': 1,
            'efficient': 1, 'successful': 1, 'tagumpay': 1
        }

        self.tagalog_negative = {
            # Basic negative words
            'masama': -1, 'pangit': -1, 'nakakaasar': -1, 'nakakainis': -1,
            'galit': -1, 'ayaw': -1, 'badtrip': -1, 'nakakagalit': -1,
            'nakakasuka': -1, 'nakakadiri': -1, 'hindi maganda': -1,

            # Intensifiers for negative
            'napakapangit': -2, 'sobrang pangit': -2, 'napakamasama': -2,
            'sobrang masama': -2, 'napakagalit': -2,

            # Additional negative expressions
            'problem': -0.5, 'issue': -0.5, 'disappointed': -1, 'disappointing': -1,
            'hindi': -0.5, 'ayaw ko': -1, 'galit ako': -1, 'bad': -1,
            'poor': -1, 'terrible': -1, 'awful': -1, 'worst': -1
        }

        # Neutral words that might indicate mixed sentiment
        self.neutral_indicators = [
            'okay', 'okay lang', 'sige', 'pwede', 'maaari', 'maybe', 'perhaps',
            'average', 'normal', 'ordinary', 'so-so', 'mediocre'
        ]

    def detect_language(self, text):
        """Detect language with confidence score"""
        try:
            lang, confidence = langid.classify(text)
            return {
                'language': lang,
                'confidence': float(confidence),
                'is_reliable': confidence > 0.7
            }
        except Exception as e:
            return {
                'language': 'unknown',
                'confidence': 0.0,
                'is_reliable': False,
                'error': str(e)
            }

    def analyze_english_sentiment(self, text):
        """Analyze English text using TextBlob"""
        try:
            analysis = TextBlob(text)
            polarity = analysis.sentiment.polarity
            subjectivity = analysis.sentiment.subjectivity

            # Classify based on polarity
            if polarity > 0.1:
                sentiment = "positive"
            elif polarity < -0.1:
                sentiment = "negative"
            else:
                sentiment = "neutral"

            return {
                'sentiment': sentiment,
                'polarity': polarity,
                'subjectivity': subjectivity,
                'confidence': min(abs(polarity) * 2, 1.0),  # Higher polarity = higher confidence
                'method': 'textblob_english'
            }
        except Exception as e:
            return {
                'sentiment': 'neutral',
                'error': f'English analysis failed: {str(e)}',
                'method': 'fallback'
            }

    def analyze_tagalog_sentiment(self, text):
        """Analyze Tagalog text using custom lexicon"""
        try:
            text_lower = text.lower()
            words = text_lower.split()

            positive_score = 0
            negative_score = 0
            neutral_count = 0

            # Check for neutral indicators first
            for neutral in self.neutral_indicators:
                if neutral in text_lower:
                    neutral_count += 1

            # Score each word
            for word in words:
                if word in self.tagalog_positive:
                    positive_score += self.tagalog_positive[word]
                elif word in self.tagalog_negative:
                    negative_score += abs(self.tagalog_negative[word])  # Make negative scores positive for comparison

            # Calculate final sentiment
            total_score = positive_score - negative_score

            # Neutral if scores are close or neutral indicators present
            if abs(total_score) < 0.5 or neutral_count > 0:
                sentiment = "neutral"
                confidence = 0.5
            elif total_score > 0:
                sentiment = "positive"
                confidence = min(total_score / 3, 1.0)  # Normalize confidence
            else:
                sentiment = "negative"
                confidence = min(abs(total_score) / 3, 1.0)

            return {
                'sentiment': sentiment,
                'positive_score': positive_score,
                'negative_score': negative_score,
                'confidence': confidence,
                'method': 'tagalog_lexicon'
            }
        except Exception as e:
            return {
                'sentiment': 'neutral',
                'error': f'Tagalog analysis failed: {str(e)}',
                'method': 'fallback'
            }

    def analyze_mixed_sentiment(self, text):
        """Analyze mixed language text by combining both methods"""
        try:
            # Try English analysis first
            english_result = self.analyze_english_sentiment(text)

            # Try Tagalog analysis
            tagalog_result = self.analyze_tagalog_sentiment(text)

            # Combine results based on confidence
            if english_result.get('confidence', 0) > tagalog_result.get('confidence', 0):
                return english_result
            else:
                return tagalog_result

        except Exception as e:
            return {
                'sentiment': 'neutral',
                'error': f'Mixed analysis failed: {str(e)}',
                'method': 'fallback'
            }

    def analyze_sentiment(self, text):
        """Main sentiment analysis method with language detection"""
        if not text or not text.strip():
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'method': 'empty_text'
            }

        # Detect language
        lang_info = self.detect_language(text)

        # Choose analysis method based on language
        if lang_info['language'] == 'en' and lang_info['is_reliable']:
            result = self.analyze_english_sentiment(text)
        elif lang_info['language'] == 'tl' and lang_info['is_reliable']:
            result = self.analyze_tagalog_sentiment(text)
        else:
            # Mixed or uncertain language
            result = self.analyze_mixed_sentiment(text)

        # Add language info to result
        result['language'] = lang_info
        return result

def generate_report(feedbacks):
    """Generate qualitative report with sentiment analysis"""
    try:
        analyzer = MultilingualSentimentAnalyzer()

        categorized_comments = {
            'positive': [],
            'negative': [],
            'neutral': []
        }

        sentiment_counts = {
            'positive': 0,
            'negative': 0,
            'neutral': 0
        }

        analyzed_feedbacks = []

        for feedback in feedbacks:
            if not feedback or not feedback.strip():
                continue

            analysis = analyzer.analyze_sentiment(feedback)
            sentiment = analysis.get('sentiment', 'neutral')

            # Categorize the comment
            categorized_comments[sentiment].append({
                'text': feedback,
                'analysis': analysis
            })

            sentiment_counts[sentiment] += 1

            analyzed_feedbacks.append({
                'text': feedback,
                'sentiment': sentiment,
                'analysis': analysis
            })

        # Calculate percentages
        total_feedbacks = len([f for f in feedbacks if f and f.strip()])
        summary = {}

        for sentiment in ['positive', 'negative', 'neutral']:
            count = sentiment_counts[sentiment]
            percentage = (count / total_feedbacks * 100) if total_feedbacks > 0 else 0
            summary[sentiment] = {
                'count': count,
                'percentage': round(percentage, 2)
            }

        return {
            'success': True,
            'summary': summary,
            'categorized_comments': categorized_comments,
            'analyzed_feedbacks': analyzed_feedbacks,
            'total_feedbacks': total_feedbacks
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Report generation failed: {str(e)}',
            'traceback': traceback.format_exc()
        }

def analyze_quantitative(current_year_data, previous_year_data, current_year, previous_year):
    """Analyze quantitative data (ratings comparison)"""
    try:
        import pandas as pd
        import numpy as np
        from scipy import stats

        # Convert to pandas Series for analysis
        current_ratings = pd.Series(current_year_data['ratings'])
        previous_ratings = pd.Series(previous_year_data['ratings'])

        current_stats = {
            'year': current_year,
            'average_rating': round(current_ratings.mean(), 2) if not current_ratings.empty else 0,
            'response_count': len(current_ratings),
            'median': round(current_ratings.median(), 2) if not current_ratings.empty else 0,
            'std_dev': round(current_ratings.std(), 2) if len(current_ratings) > 1 else 0,
            'min_rating': current_ratings.min() if not current_ratings.empty else 0,
            'max_rating': current_ratings.max() if not current_ratings.empty else 0
        }

        previous_stats = {
            'year': previous_year,
            'average_rating': round(previous_ratings.mean(), 2) if not previous_ratings.empty else 0,
            'response_count': len(previous_ratings),
            'median': round(previous_ratings.median(), 2) if not previous_ratings.empty else 0,
            'std_dev': round(previous_ratings.std(), 2) if len(previous_ratings) > 1 else 0,
            'min_rating': previous_ratings.min() if not previous_ratings.empty else 0,
            'max_rating': previous_ratings.max() if not previous_ratings.empty else 0
        }

        # Calculate improvement metrics
        improvement = {
            'rating_change': round(current_stats['average_rating'] - previous_stats['average_rating'], 2),
            'response_change': current_stats['response_count'] - previous_stats['response_count'],
            'rating_improved': current_stats['average_rating'] > previous_stats['average_rating'],
            'response_increased': current_stats['response_count'] > previous_stats['response_count']
        }

        # Statistical significance test (if we have enough data)
        significance_test = None
        if len(current_ratings) >= 3 and len(previous_ratings) >= 3:
            try:
                t_stat, p_value = stats.ttest_ind(current_ratings, previous_ratings, equal_var=False)
                significance_test = {
                    't_statistic': round(t_stat, 3),
                    'p_value': round(p_value, 3),
                    'significant': p_value < 0.05
                }
            except:
                pass

        return {
            'success': True,
            'current_year': current_stats,
            'previous_year': previous_stats,
            'improvement': improvement,
            'significance_test': significance_test
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Quantitative analysis failed: {str(e)}',
            'traceback': traceback.format_exc()
        }

def main():
    """Main function to handle different analysis actions"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({'success': False, 'error': 'No input data received'}))
            return

        data = json.loads(input_data)
        action = data.get('action')

        if action == 'generate_report':
            feedbacks = data.get('feedbacks', [])
            result = generate_report(feedbacks)
            print(json.dumps(result))

        elif action == 'analyze_quantitative':
            current_year_data = data.get('currentYearData', {})
            previous_year_data = data.get('previousYearData', {})
            current_year = data.get('currentYear', 2024)
            previous_year = data.get('previousYear', 2023)
            result = analyze_quantitative(current_year_data, previous_year_data, current_year, previous_year)
            print(json.dumps(result))

        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown action: {action}'
            }))

    except Exception as e:
        error_result = {
            'success': False,
            'error': f'Main execution failed: {str(e)}',
            'traceback': traceback.format_exc()
        }
        print(json.dumps(error_result))

if __name__ == '__main__':
    main()