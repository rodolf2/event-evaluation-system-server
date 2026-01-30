"""
Text Analysis Script for Event Evaluation System
Implements multilingual sentiment analysis for English and Tagalog/Filipino text
Uses TextBlob for advanced sentiment analysis with custom Tagalog lexicon
"""

import sys
import os
import json
import traceback
import re

# ROBUST PATH INJECTION: Look for python_libs in script directory
# This fixes ModuleNotFoundError on Render where PYTHONPATH might be lost
script_dir = os.path.dirname(os.path.abspath(__file__))
python_libs_dir = os.path.join(script_dir, 'python_libs')
if os.path.isdir(python_libs_dir):
    sys.path.append(python_libs_dir)
# Also check Render-specific path just in case
render_libs = '/opt/render/project/src/python_libs'
if os.path.isdir(render_libs) and render_libs not in sys.path:
    sys.path.append(render_libs)

from textblob import TextBlob
import langid

class MultilingualSentimentAnalyzer:
    def __init__(self, custom_lexicon=None):
        # Enhanced Tagalog sentiment lexicons with phrase patterns
        self.tagalog_positive = {
            # Basic positive words and roots (weight: 1)
            'maganda': 1, 'ganda': 1, 'mabuti': 1, 'buti': 1,
            'masaya': 1, 'saya': 1, 'nakakatuwa': 1, 'tuwa': 1,
            'galing': 1, 'magaling': 1, 'bilib': 1, 'husay': 1,
            'mahusay': 1, 'astig': 1, 'sulit': 1, 'panalo': 1,
            'maayos': 1, 'ayos': 1, 'linis': 1, 'malinis': 1,
            'effective': 1, 'efficient': 1, 'successful': 1, 'tagumpay': 1,
            'productive': 1, 'organized': 1, 'smooth': 1, 'professional': 1,
            'natuto': 1, 'natutunan': 1, 'nakatulong': 1, 'helpful': 1,
            'satisfied': 1, 'fun': 1, 'interesting': 1, 'educational': 1,
            'useful': 1, 'motivating': 1, 'solid': 1, 'swabe': 1,
            'oks': 0.5, 'goods': 1, 'nice': 1, 'yes': 1, 'oo': 1,
            'sige': 0.5, 'salamat': 1, 'grateful': 1, 'appreciate': 1,
            'appreciated': 1, 'thankful': 1
        }

        self.tagalog_negative = {
            # Basic negative words and roots (weight: -1)
            'masama': -1, 'sama': -1, 'pangit': -1, 'panget': -1,
            'nakakaasar': -1, 'asar': -1, 'nakakainis': -1, 'inis': -1,
            'galit': -1, 'ayaw': -1, 'badtrip': -1, 'nakakagalit': -1,
            'boring': -1, 'nakakaantok': -1, 'sayang': -1,
            'disappointed': -1, 'disappointing': -1, 'nakakadismaya': -1,
            'dismaya': -1, 'dismayado': -1, 'nabigo': -1, 'failed': -1,
            'problem': -0.7, 'problema': -0.7, 'mali': -0.8,
            'kulang': -0.7, 'kakulangan': -0.8, 'incomplete': -0.7, 'poor': -1,
            'crowded': -0.8, 'difficult': -0.8, 'nahirapan': -0.8, 'hard': -0.7,
            'frustrated': -1, 'frustrating': -1, 'nakakafrustrate': -1,
            'bad': -1, 'worst': -2, 'disorganized': -1, 'chaotic': -1,
            'magulo': -0.8, 'noisy': -0.6, 'late': -0.7, 'delayed': -0.7,
            'matagal': -0.6, 'mabagal': -0.6, 'unprepared': -0.8,
            'unprofessional': -1, 'mediocre': -0.6, 'meh': -0.5,
            'reklamo': -1, 'bagsak': -1.5, 'lungkot': -1, 'nakakalungkot': -1
        }

        # Common Filipino phrases for context
        self.positive_phrases = [
            'very good', 'ang ganda', 'sobrang ganda', 'sobra ganda', 'ang galing',
            'maraming salamat', 'thank you so much', 'napakaganda',
            'napakagaling', 'the best', 'well done', 'job well done',
            'great job', 'excellent work', 'love it', 'loved it',
            'napakasaya', 'sobrang saya', 'sobra saya', 'ang saya',
            'napakaayos', 'sobrang ayos', 'ang husay', 'napakatahimik',
            'well-organized', 'well-prepared', 'well-managed', 'well-planned'
        ]

        self.negative_phrases = [
            'not good', 'not great', 'hindi maganda', 'walang kwenta',
            'waste of time', 'sayang lang', 'hindi ako satisfied',
            'bad experience', 'poor quality', 'very bad', 'so bad',
            'napakamasama', 'sobrang masama', 'ang sama',
            'napakapangit', 'sobrang pangit', 'hindi prepared',
            'hindi naging maayos', 'hindi maayos', 'hindi okay',
            'hindi ayos', 'di maayos', 'di maganda', 'waste of energy'
        ]

        # Neutral words that might indicate mixed sentiment
        self.neutral_indicators = [
            # English neutral
            'okay', 'ok', 'alright', 'fine', 'so-so', 'average', 'normal', 
            'ordinary', 'mediocre', 'fair', 'decent', 'not bad', 'moderate',
            'acceptable', 'passable', 'adequate', 'sufficient','however'
            # Tagalog neutral - common expressions
            'okay lang', 'ok lang', 'oks lang', 'ayos lang', 'pwede na', 
            'pwede naman', 'ganon lang', 'ganun lang', 'sige lang', 
            'lang naman', 'naman', 'typical', 'karaniwan', 'normal lang',
            'sige', 'pwede', 'maaari', 'maybe', 'perhaps', 'siguro',
            # Mixed/hesitant expressions
            'may improvement', 'pwede pang', 'pero okay', 'pero ayos'
        ]
        
        # Negation words
        self.negations = [
            'not', 'no', 'never', 'hindi', 'wala', 'walang', 'di', 'di ko', 'hinde'
        ]
        
        # Intensifiers and diminishers
        self.intensifiers = [
            'very', 'really', 'extremely', 'super', 'sobra', 'sobrang',
            'napaka', 'labis', 'grabe', 'talaga', 'so', 'too', 'ganado', 'masyado'
        ]
        
        self.diminishers = [
            'slightly', 'somewhat', 'a bit', 'a little', 'medyo', 'konti',
            'kaunti', 'bahagya'
        ]
        
        # Emoticons and emoji patterns
        self.positive_emoticons = ['😊', '😀', '😄', '😍', '👍', '🙌', '🎉', ':)', ':-)', ':D']
        self.negative_emoticons = ['😞', '😢', '😠', '😡', '👎', '😕', '😔', ':(', ':-(', 'D:']

        # Common Tagalog affixes for stemming
        self.tagalog_prefixes = ['nag-', 'nag', 'mag-', 'mag', 'na-', 'na', 'ma-', 'ma', 'naka-', 'naka', 'ipinag-', 'ipinag', 'pag-', 'pag']
        self.tagalog_suffixes = ['-an', 'an', '-in', 'in', '-nan', 'nan', '-hin', 'hin']

        # Load custom lexicon if provided
        if custom_lexicon:
            self.load_custom_lexicon(custom_lexicon)

    def stem_tagalog(self, word):
        """Simple rule-based stemming for Tagalog/Taglish"""
        if len(word) <= 4:
            return word
        
        stemmed = word
        # Handle prefixes
        for prefix in sorted(self.tagalog_prefixes, key=len, reverse=True):
            if stemmed.startswith(prefix):
                stemmed = stemmed[len(prefix):]
                if stemmed.startswith('-'):
                    stemmed = stemmed[1:]
                break
        
        # Handle suffixes
        if len(stemmed) > 4:
            for suffix in sorted(self.tagalog_suffixes, key=len, reverse=True):
                if stemmed.endswith(suffix):
                    stemmed = stemmed[:-len(suffix)]
                    if stemmed.endswith('-'):
                        stemmed = stemmed[:-1]
                    break
        
        return stemmed if len(stemmed) >= 3 else word

    def load_custom_lexicon(self, lexicon):
        """Load lexicon from database format"""
        # Clear default lexicons to prioritize DB lexicon if that's the intention
        # Or just update them. Let's update/extend.
        for item in lexicon:
            word = item.get('word', '').lower()
            sentiment = item.get('sentiment')
            weight = float(item.get('weight', 1.0))
            language = item.get('language', 'en')
            is_phrase = item.get('isPhrase', False)

            if language == 'tl':
                if sentiment == 'positive':
                    self.tagalog_positive[word] = weight
                    if is_phrase:
                        self.positive_phrases.append(word)
                elif sentiment == 'negative':
                    self.tagalog_negative[word] = -weight
                    if is_phrase:
                        self.negative_phrases.append(word)
                elif sentiment == 'neutral':
                    self.neutral_indicators.append(word)
            # For English, TextBlob handles basic words, but we can boost them
            # if we implement a custom English scoring wrap. 
            # For now, focus on Tagalog as it's the primary custom lexicon target.


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
        """Analyze English text using TextBlob with enhanced context"""
        try:
            analysis = TextBlob(text)
            polarity = analysis.sentiment.polarity
            subjectivity = analysis.sentiment.subjectivity

            # Check for emoticons
            emoticon_boost = 0
            for emoticon in self.positive_emoticons:
                if emoticon in text:
                    emoticon_boost += 0.15
            for emoticon in self.negative_emoticons:
                if emoticon in text:
                    emoticon_boost -= 0.15
            
            # Adjust polarity with emoticon boost
            polarity = max(-1, min(1, polarity + emoticon_boost))

            # Enhanced classification with tighter thresholds
            if polarity > 0.15:
                sentiment = "positive"
            elif polarity < -0.15:
                sentiment = "negative"
            else:
                sentiment = "neutral"

            # Enhanced confidence based on polarity magnitude and subjectivity
            confidence = min((abs(polarity) + 0.2) * 1.2, 1.0)

            return {
                'sentiment': sentiment,
                'polarity': polarity,
                'subjectivity': subjectivity,
                'confidence': confidence,
                'method': 'textblob_english_enhanced'
            }
        except Exception as e:
            return {
                'sentiment': 'neutral',
                'error': f'English analysis failed: {str(e)}',
                'method': 'fallback'
            }

    def analyze_sentence_sentiment(self, sentence):
        """Analyze sentiment of individual sentences for mixed content detection"""
        sentence_lower = sentence.lower()
        pos_score = 0
        neg_score = 0

        # Check for constructive criticism patterns (English and Tagalog)
        constructive_patterns = [
            'could be improved', 'could still be improved', 'room for improvement',
            'with a few adjustments', 'next time', 'believe the next', 'can be even better',
            'some areas', 'however', 'but', 'although',
            'maaaring pagbutihin', 'maaaring mapabuti', 'may mga areas na maaaring',
            'sa susunod', 'next time', 'pwede pang mapabuti', 'sana ay maayos',
            'pero', 'ngunit', 'subalit', 'gayunpaman'
        ]

        is_constructive = any(pattern in sentence_lower for pattern in constructive_patterns)

        # Word analysis for this sentence
        words = sentence_lower.split()
        for i, word in enumerate(words):
            is_negated = i > 0 and words[i-1] in self.negations
            multiplier = 1.5 if i > 0 and words[i-1] in self.intensifiers else 1.0
            
            # Direct check
            stemmed = self.stem_tagalog(word)
            
            # Check both original and stemmed
            if word in self.tagalog_positive or stemmed in self.tagalog_positive:
                score = (self.tagalog_positive.get(word) or self.tagalog_positive.get(stemmed)) * multiplier
                pos_score += score if not is_negated else 0
                neg_score += score if is_negated else 0
            elif word in self.tagalog_negative or stemmed in self.tagalog_negative:
                score = abs(self.tagalog_negative.get(word) or self.tagalog_negative.get(stemmed)) * multiplier
                neg_score += score if not is_negated else 0
                pos_score += score if is_negated else 0

        return {
            'positive': pos_score,
            'negative': neg_score,
            'is_constructive': is_constructive,
            'balance': pos_score - neg_score
        }

    def analyze_tagalog_sentiment(self, text):
        """Analyze Tagalog/Filipino text using enhanced lexicon with context and sentence-level analysis"""
        try:
            text_lower = text.lower()

            # Initialize scores
            positive_score = 0
            negative_score = 0
            neutral_count = 0
            constructive_criticism_count = 0
            emoticon_score = 0

            # Check for emoticons first
            for emoticon in self.positive_emoticons:
                if emoticon in text:
                    emoticon_score += 0.5
            for emoticon in self.negative_emoticons:
                if emoticon in text:
                    emoticon_score -= 0.5

            # Check for neutral indicators
            for neutral in self.neutral_indicators:
                if neutral in text_lower:
                    neutral_count += 1

            # Helper for phrase/word negation check
            def is_negated_context(text, start_idx):
                if start_idx <= 0: return False
                # Check preceding 20 characters for negation words
                context = text[max(0, start_idx-20):start_idx].lower()
                context_words = re.findall(r"\w+", context)
                return any(neg in context_words for neg in self.negations)

            # Check for positive and negative phrases (higher weight)
            # Sort phrases by length (descending) to match longest phrases first
            sorted_pos_phrases = sorted(self.positive_phrases, key=len, reverse=True)
            sorted_neg_phrases = sorted(self.negative_phrases, key=len, reverse=True)
            
            used_phrase_ranges = []

            for phrase in sorted_pos_phrases:
                if phrase in text_lower:
                    # Use word boundaries for phrase matching to avoid partial matches
                    pattern = r'\b' + re.escape(phrase) + r'\b'
                    for m in re.finditer(pattern, text_lower):
                        start_idx = m.start()
                        phrase_range = range(start_idx, m.end())
                        
                        # Skip if this range is already covered by a longer phrase
                        if any(start_idx in r for r in used_phrase_ranges):
                            continue
                            
                        if is_negated_context(text_lower, start_idx):
                            negative_score += 2.0
                        else:
                            positive_score += 2.5
                        used_phrase_ranges.append(phrase_range)

            for phrase in sorted_neg_phrases:
                if phrase in text_lower:
                    pattern = r'\b' + re.escape(phrase) + r'\b'
                    for m in re.finditer(pattern, text_lower):
                        start_idx = m.start()
                        phrase_range = range(start_idx, m.end())
                        
                        if any(start_idx in r for r in used_phrase_ranges):
                            continue
                            
                        if is_negated_context(text_lower, start_idx):
                            positive_score += 2.0
                        else:
                            negative_score += 2.5
                        used_phrase_ranges.append(phrase_range)

            # Word-by-word analysis with context
            words_data = list(re.finditer(r"[\w']+", text_lower))
            words = [m.group() for m in words_data]
            
            # Sentence-level analysis (moved up to avoid NameError if used later)
            sentences = [s.strip() for s in text.replace('!', '.').replace('?', '.').split('.') if s.strip()]
            sentence_sentiments = []

            for sentence in sentences:
                sent_analysis = self.analyze_sentence_sentiment(sentence)
                sentence_sentiments.append(sent_analysis)
                if sent_analysis['is_constructive']:
                    constructive_criticism_count += 1

            # Word-level loop
            for i, match in enumerate(words_data):
                word = match.group()
                word_start = match.start()

                # Skip if this word is part of an already analyzed phrase
                if any(word_start in r for r in used_phrase_ranges):
                    continue

                # Check for negation before the word
                is_negated = is_negated_context(text_lower, word_start)

                # Check for intensifiers before the word
                multiplier = 1.0
                # Check previous 2 words for intensifiers/diminishers
                for j in range(max(0, i-2), i):
                    if words[j] in self.intensifiers:
                        multiplier = 2.0 # Stronger boost
                        break
                    elif words[j] in self.diminishers:
                        multiplier = 0.5
                        break

                # Stemming
                stemmed = self.stem_tagalog(word)

                # Score the word (check original and stemmed)
                if word in self.tagalog_positive or stemmed in self.tagalog_positive:
                    score = (self.tagalog_positive.get(word) or self.tagalog_positive.get(stemmed)) * multiplier
                    if is_negated:
                        negative_score += score
                    else:
                        positive_score += score

                elif word in self.tagalog_negative or stemmed in self.tagalog_negative:
                    score = abs(self.tagalog_negative.get(word) or self.tagalog_negative.get(stemmed)) * multiplier
                    if is_negated:
                        positive_score += score
                    else:
                        negative_score += score

            # Add emoticon score
            if emoticon_score > 0:
                positive_score += emoticon_score
            elif emoticon_score < 0:
                negative_score += abs(emoticon_score)

            # Analyze sentence balance
            positive_sentences = sum(1 for s in sentence_sentiments if s['balance'] > 0.5)
            negative_sentences = sum(1 for s in sentence_sentiments if s['balance'] < -0.5)
            neutral_sentences = len(sentence_sentiments) - positive_sentences - negative_sentences

            # Calculate final sentiment
            total_score = positive_score - negative_score

            # Sentiment determination
            has_mixed_sentiment = (positive_sentences > 0 and negative_sentences > 0) or constructive_criticism_count > 0
            has_significant_negative = negative_score >= 1.0
            score_ratio = abs(total_score) / max(positive_score + negative_score, 1)

            if neutral_count >= 1 and positive_score < 1.0 and negative_score < 1.0:
                sentiment = "neutral"
                confidence = 0.75
            elif has_mixed_sentiment and (constructive_criticism_count >= 2 or has_significant_negative):
                sentiment = "neutral"
                confidence = 0.8
            elif total_score >= 0.7: # Lowered threshold slightly for Tagalog
                sentiment = "positive"
                confidence = min(0.6 + (total_score / 10), 0.95)
            elif total_score <= -0.7:
                sentiment = "negative"
                confidence = min(0.6 + (abs(total_score) / 10), 0.95)
            else:
                sentiment = "neutral"
                confidence = 0.65

            return {
                'sentiment': sentiment,
                'positive_score': round(positive_score, 2),
                'negative_score': round(negative_score, 2),
                'total_score': round(total_score, 2),
                'confidence': round(confidence, 2),
                'method': 'tagalog_lexicon_enhanced',
                'sentence_analysis': {
                    'total_sentences': len(sentence_sentiments),
                    'positive_sentences': positive_sentences,
                    'negative_sentences': negative_sentences,
                    'neutral_sentences': neutral_sentences,
                    'constructive_criticism': constructive_criticism_count
                }
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
            text_lower = text.lower()
            
            # First check for neutral indicators (important for Tagalog expressions)
            neutral_count = sum(1 for indicator in self.neutral_indicators if indicator in text_lower)
            
            # Try Tagalog analysis first (since it has better neutral detection for Filipino phrases)
            tagalog_result = self.analyze_tagalog_sentiment(text)
            
            # Try English analysis
            english_result = self.analyze_english_sentiment(text)

            # If neutral indicators are present and Tagalog analysis says neutral, trust it
            if neutral_count >= 1 and tagalog_result.get('sentiment') == 'neutral':
                return tagalog_result
                
            # If Tagalog has high positive/negative score, trust it (it has strong lexicon matches)
            tagalog_total = abs(tagalog_result.get('total_score', 0))
            if tagalog_total >= 2.0:
                return tagalog_result
            
            # Otherwise, combine results based on confidence
            # Check for contrast indicators in the whole text
            contrast_words = ['but', 'however', 'although', 'pero', 'ngunit', 'subalit']
            has_contrast = any(word in text_lower for word in contrast_words)

            if has_contrast and (tagalog_result.get('positive_score', 0) > 0 or tagalog_result.get('negative_score', 0) > 0):
                # If there's contrast and ANY sentiment found, lean towards neutral
                return {
                    'sentiment': 'neutral',
                    'confidence': 0.8,
                    'method': 'mixed_contrast_override',
                    'original_english': english_result,
                    'original_tagalog': tagalog_result
                }

            if english_result.get('confidence', 0) > tagalog_result.get('confidence', 0):
                # If Tagalog found strong tokens even if English has higher confidence, blend them
                if tagalog_total > 1.0:
                    blended_sentiment = 'positive' if (english_result.get('polarity', 0) + tagalog_result.get('total_score', 0)) > 0 else 'negative'
                    return {
                        'sentiment': blended_sentiment,
                        'confidence': (english_result.get('confidence', 0) + tagalog_result.get('confidence', 0)) / 2,
                        'method': 'blended_mixed_confidence'
                    }
                return english_result
            else:
                return tagalog_result

        except Exception as e:
            return {
                'sentiment': 'neutral',
                'error': f'Mixed analysis failed: {str(e)}',
                'method': 'fallback'
            }

    def remove_emojis(self, text):
        """Remove emojis from text to strengthen evaluation integrity"""
        # Remove emoticons and emoji patterns
        for emoticon in self.positive_emoticons + self.negative_emoticons:
            text = text.replace(emoticon, '')
        
        # Remove Unicode emojis (basic pattern)
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map symbols
            "\U0001F1E0-\U0001F1FF"  # flags (iOS)
            "\U00002702-\U000027B0"  # dingbats
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        return emoji_pattern.sub('', text).strip()

    def analyze_sentiment(self, text):
        """Main sentiment analysis method with language detection"""
        if not text or not text.strip():
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'method': 'empty_text'
            }

        # Remove emojis to strengthen evaluation integrity (FR5 requirement)
        cleaned_text = self.remove_emojis(text)
        
        if not cleaned_text:
            return {
                'sentiment': 'neutral',
                'confidence': 0.0,
                'method': 'empty_after_emoji_removal',
                'original_text': text,
                'cleaned_text': cleaned_text
            }

        # Detect language
        lang_info = self.detect_language(cleaned_text)
        text_lower = cleaned_text.lower()

        # Custom check for strong Tagalog indicators
        has_strong_tagalog = any(phrase in text_lower for phrase in self.positive_phrases + self.negative_phrases)
        if not has_strong_tagalog:
            # Check for words (with boundaries to avoid partial matches)
            words = re.findall(r"\w+", text_lower)
            has_strong_tagalog = any(word in self.tagalog_positive or word in self.tagalog_negative for word in words)

        # Choose analysis method based on language
        # Be more skeptical of English detection for Tagalog words that might be misclassified
        if lang_info['language'] == 'en' and lang_info['is_reliable'] and not has_strong_tagalog:
            result = self.analyze_english_sentiment(cleaned_text)
        elif lang_info['language'] == 'tl':
            result = self.analyze_tagalog_sentiment(cleaned_text)
        else:
            # Mixed, uncertain, or English with Tagalog tokens
            result = self.analyze_mixed_sentiment(cleaned_text)

        # Add language info and emoji removal info to result
        result['language'] = lang_info
        result['emoji_removal'] = {
            'original_text': text,
            'cleaned_text': cleaned_text,
            'emojis_removed': text != cleaned_text
        }
        return result

def split_comment_by_sentiment(text, analyzer):
    """Split a comment into positive and negative sentence groups"""
    try:
        # Split into sentences
        sentences = [s.strip() for s in text.replace('!', '.').replace('?', '.').split('.') if s.strip()]

        positive_sentences = []
        negative_sentences = []
        neutral_sentences = []

        for sentence in sentences:
            sent_analysis = analyzer.analyze_sentence_sentiment(sentence)
            balance = sent_analysis['balance']

            if balance > 0.3:
                positive_sentences.append(sentence)
            elif balance < -0.3:
                negative_sentences.append(sentence)
            else:
                neutral_sentences.append(sentence)

        # Combine sentences back into text blocks
        positive_text = '. '.join(positive_sentences) + ('.' if positive_sentences else '')
        negative_text = '. '.join(negative_sentences) + ('.' if negative_sentences else '')
        neutral_text = '. '.join(neutral_sentences) + ('.' if neutral_sentences else '')

        return {
            'positive_part': positive_text.strip(),
            'negative_part': negative_text.strip(),
            'neutral_part': neutral_text.strip(),
            'sentence_counts': {
                'positive': len(positive_sentences),
                'negative': len(negative_sentences),
                'neutral': len(neutral_sentences)
            }
        }

    except Exception as e:
        return {
            'positive_part': text,
            'negative_part': '',
            'neutral_part': '',
            'sentence_counts': {'positive': 0, 'negative': 0, 'neutral': 0},
            'error': str(e)
        }

def generate_report(feedbacks, lexicon=None):
    """Generate qualitative report with sentiment analysis and comment splitting"""
    try:
        analyzer = MultilingualSentimentAnalyzer(custom_lexicon=lexicon)

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

            # Split comment into positive/negative parts
            comment_parts = split_comment_by_sentiment(feedback, analyzer)

            # Categorize the comment
            categorized_comments[sentiment].append({
                'text': feedback,
                'analysis': analysis,
                'parts': comment_parts
            })

            sentiment_counts[sentiment] += 1

            analyzed_feedbacks.append({
                'text': feedback,
                'sentiment': sentiment,
                'analysis': analysis,
                'parts': comment_parts
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
            lexicon = data.get('lexicon', None)
            result = generate_report(feedbacks, lexicon=lexicon)
            print(json.dumps(result))

        elif action == 'analyze_quantitative':
            current_year_data = data.get('currentYearData', {})
            previous_year_data = data.get('previousYearData', {})
            current_year = data.get('currentYear', 2024)
            previous_year = data.get('previousYear', 2023)
            result = analyze_quantitative(current_year_data, previous_year_data, current_year, previous_year)
            print(json.dumps(result))

        elif action == 'analyze_single':
            # Analyze a single comment and return sentiment
            comment = data.get('comment', '')
            lexicon = data.get('lexicon', None)
            if not comment or not comment.strip():
                print(json.dumps({
                    'success': True,
                    'sentiment': 'neutral',
                    'confidence': 0.0,
                    'method': 'empty_text'
                }))
            else:
                analyzer = MultilingualSentimentAnalyzer(custom_lexicon=lexicon)
                result = analyzer.analyze_sentiment(comment)
                print(json.dumps({
                    'success': True,
                    'sentiment': result.get('sentiment', 'neutral'),
                    'confidence': result.get('confidence', 0.5),
                    'method': result.get('method', 'unknown'),
                    'details': result
                }))

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