import sys
import os
import json
from text_analysis import MultilingualSentimentAnalyzer

def test_sentences():
    analyzer = MultilingualSentimentAnalyzer()
    
    test_cases = [
        # Positive
        "Magandang karanasan! Ang mga speaker ay tunay na eksperto.",
        "Very informative talaga ang event. Ang speakers ay amazing!",
        
        # Negative
        "I regret coming here, it was a complete mess.",
        "Ang content ay outdated. Parang old material lang.",
        "Ang audio quality ay napakagulo. Hindi maintindihan.",

        # Should be Neutral (User reported as Positive)
        "None of the topics were relevant to my course.",
        "Good overall, but the venue could be improved.",
        "The event was okay. Some sessions were better than others."
    ]
    
    print(f"{'Text':<60} | {'Sentiment':<10} | {'Score':<6} | {'Language':<10}")
    print("-" * 100)
    
    for text in test_cases:
        result = analyzer.analyze_sentiment(text)
        sentiment = result.get('sentiment', 'N/A')
        total_score = result.get('total_score', 0)
        # If english/mixed, might be under 'polarity' or 'combined_polarity'
        if 'polarity' in result: 
            score = result['polarity']
        elif 'total_score' in result:
            score = result['total_score']
        else:
            score = 0
            
        lang = result.get('language', {}).get('language', 'unknown')
        
        print(f"{text[:58]:<60} | {sentiment:<10} | {score:<6} | {lang:<10}")
        # print(json.dumps(result, indent=2)) # Uncomment for deep detail

if __name__ == "__main__":
    test_sentences()
