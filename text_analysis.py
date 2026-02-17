"""
Text Analysis Script for Event Evaluation System
Implements multilingual sentiment analysis for English and Tagalog/Filipino text
Uses TextBlob for English analysis with custom Tagalog lexicon
"""

import sys
import os
import json
import traceback
import re

from textblob import TextBlob
# Note: langid removed for memory efficiency - using heuristic language detection

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
            'eksperto': 1, 'expert': 1, 'knowledgeable': 1, 'matalino': 1,
            'natuto': 1, 'natutunan': 1, 'nakatulong': 1, 'helpful': 1,
            'satisfied': 1, 'fun': 1, 'interesting': 1, 'educational': 1,
            'useful': 1, 'motivating': 1, 'solid': 1, 'swabe': 1,
            'oks': 0.5, 'goods': 1, 'nice': 1, 'yes': 1, 'oo': 1,
            'grateful': 1, 'appreciate': 1, 'appreciated': 1, 'thankful': 1,
            'informative': 1, 'amazing': 1, 'excellent': 1, 'great': 1,
            'karanasan': 0.5, 'experience': 0.5, 'malinaw': 1, 'clear': 1
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
            # Chaos/disorder (stronger weights)
            'magulo': -1.2, 'gulo': -1.2, 'noisy': -0.6, 'late': -0.7, 'delayed': -0.7,
            'matagal': -1, 'mabagal': -0.6, 'unprepared': -0.8, 'tagal': -0.8,
            'unprofessional': -1, 'mediocre': -0.6, 'meh': -0.5,
            'reklamo': -1, 'bagsak': -1.5, 'lungkot': -1, 'nakakalungkot': -1,
            # Queue/waiting complaints (stronger weights)
            'disaster': -1.5, 'terrible': -1.5, 'horrible': -1.5, 'awful': -1.5,
            'waited': -1, 'waiting': -0.8, 'antay': -1, 'hintay': -1, 'naghintay': -1,
            'pila': -0.5, 'hours': -0.6, 'horas': -0.6, 'oras': -0.1, 'dalawa': -0.3,
            # Physical discomfort/Environmental
            'mainit': -1, 'init': -1, 'maingay': -1, 'ingay': -1,
            'mausok': -1, 'usok': -1, 'siksikan': -1, 'crowded': -1,
            'madumi': -1, 'dumi': -1, 'mabaho': -1, 'baho': -1,
            'sira': -1, 'broken': -1, 'gutom': -1, 'starving': -1,
            # Additional strong negative words
            'hassle': -1, 'inconvenient': -1, 'uncomfortable': -0.8,
            'outdated': -1, 'uma': -1, 'luma': -1, 'old': -0.8,
            'mess': -1, 'kalat': -1, 'sabog': -1, 'labo': -1, 'malabo': -1,
            'regret': -1.5, 'sisi': -1.5, 'maintindihan': -0.5, # Usually negated
            'unclear': -1, 'confusing': -1, 'nakakalito': -1,
            'hassle': -1, 'inconvenient': -1, 'uncomfortable': -0.8,
            'unacceptable': -1.2, 'ridiculous': -1, 'absurd': -1,
            'annoying': -1, 'annoyed': -1, 'irritating': -1, 'irritated': -1,
            'stressful': -1, 'stressed': -0.8, 'tiring': -0.7, 'exhausting': -0.8,
            'pagod': -0.6, 'napagod': -0.7, 'hirap': -0.8, 'mahirap': -0.8,
            # Common complaint verbs
            'pasok': -0.2, 'loob': -0.1, 'bago': -0.1
        }

        # Common Filipino phrases for context
        self.positive_phrases = [
            'very good', 'ang ganda', 'sobrang ganda', 'sobra ganda', 'ang galing',
            'maraming salamat', 'thank you so much', 'napakaganda',
            'napakagaling', 'the best', 'well done', 'job well done',
            'great job', 'excellent work', 'love it', 'loved it',
            'napakasaya', 'sobrang saya', 'sobra saya', 'ang saya',
            'napakaayos', 'sobrang ayos', 'ang husay', 'napakatahimik',
            'well-organized', 'well-prepared', 'well-managed', 'well-planned',
            'looking forward', 'expecting more', 'next year', 'next event',
            'magandang karanasan', 'good experience', 'great experience',
            'very informative', 'sobrang informative', 'amazing speakers',
            'ang galing', 'ang husay', 'tunay na eksperto', 'real experts'
        ]

        self.negative_phrases = [
            'not good', 'not great', 'hindi maganda', 'walang kwenta',
            'waste of time', 'sayang lang', 'hindi ako satisfied',
            'bad experience', 'poor quality', 'very bad', 'so bad',
            'napakamasama', 'sobrang masama', 'ang sama',
            'napakapangit', 'sobrang pangit', 'hindi prepared',
            'hindi naging maayos', 'hindi maayos', 'hindi okay',
            'hindi ayos', 'di maayos', 'di maganda', 'waste of energy',
            # Queue/waiting complaints
            'sobrang gulo', 'sobra gulo', 'ang gulo', 'napakatagal',
            'waited for hours', 'waited for two hours', 'waited too long',
            'matagal na pila', 'mahabang pila', 'ang tagal', 'sobrang tagal',
            'dalawang oras', 'isang oras', 'nag-antay', 'naghintay',
            'was a disaster', 'total disaster', 'complete disaster',
            'could have been better', 'needs improvement', 'room for improvement',
            'medyo magulo', 'medyo matagal', 'medyo mainit',
            'complete mess', 'hindi maintindihan', 'di maintindihan',
            'audio quality', 'poor audio', 'bad audio', 'outdated content',
            'old material', 'lumang material', 'complete disaster',
            'total mess', 'regret coming', 'waste of money'
        ]

        # Neutral words that might indicate mixed sentiment
        self.neutral_indicators = [
            # English neutral
            'okay', 'ok', 'alright', 'fine', 'so-so', 'average', 'normal', 
            'ordinary', 'mediocre', 'fair', 'decent', 'not bad', 'moderate',
            'acceptable', 'passable', 'adequate', 'sufficient', 'however',
            # Tagalog neutral - common expressions (prioritized patterns)
            'okay lang', 'ok lang', 'oks lang', 'ayos lang', 'pwede na', 
            'pwede naman', 'ganon lang', 'ganun lang', 'sige lang', 
            'lang naman', 'naman', 'typical', 'karaniwan', 'normal lang',
            'sige', 'pwede', 'maaari', 'maybe', 'perhaps', 'siguro',
            # Key neutral Tagalog expressions with "lang" (just/only) modifier
            'sakto lang', 'sakto', 'tama lang', 'kaya lang', 'medyo',
            'walang masyadong', 'walang special', 'walang espesyal',
            # Mixed/hesitant expressions
            'may improvement', 'pwede pang', 'pero okay', 'pero ayos'
        ]
        
        # Contrast words that often indicate mixed sentiment (positive + negative)
        self.contrast_indicators = [
            'but', 'however', 'although', 'though', 'yet', 'except',
            'pero', 'kaya lang', 'kaso', 'subalit', 'ngunit',
            'on the other hand', 'at the same time', 'i feel like',
            'could have been', 'should have been', 'wish it was'
        ]
        
        # Negation words
        self.negations = [
            'not', 'no', 'never', 'hindi', 'wala', 'walang', 'di', 'di ko', 'hinde', 'none', 'neither'
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
        """Detect language using fast heuristics (no ML model loading)"""
        try:
            text_lower = text.lower()
            words = set(re.findall(r"\w+", text_lower))
            
            # Count Tagalog indicators
            tagalog_words = words.intersection(set(self.tagalog_positive.keys()) | set(self.tagalog_negative.keys()))
            
            # Common Tagalog function words and markers
            tagalog_markers = {'ang', 'ng', 'mga', 'sa', 'na', 'ay', 'ko', 'mo', 'niya', 
                              'kami', 'tayo', 'sila', 'po', 'opo', 'ba', 'din', 'rin',
                              'lang', 'lamang', 'pero', 'kasi', 'kaya', 'dahil', 'para',
                              'naman', 'talaga', 'sobra', 'napaka', 'grabe', 'yung'}
            tagalog_marker_count = len(words.intersection(tagalog_markers))
            
            # Check for Tagalog phrases
            has_tagalog_phrase = any(phrase in text_lower for phrase in 
                                     self.positive_phrases + self.negative_phrases)
            
            # Determine language based on heuristics
            tagalog_score = len(tagalog_words) + tagalog_marker_count + (2 if has_tagalog_phrase else 0)
            
            if tagalog_score >= 2 or has_tagalog_phrase:
                return {
                    'language': 'tl',
                    'confidence': min(0.9, 0.5 + tagalog_score * 0.1),
                    'is_reliable': True
                }
            elif tagalog_score == 1:
                return {
                    'language': 'mixed',
                    'confidence': 0.5,
                    'is_reliable': False
                }
            else:
                # Assume English if no Tagalog indicators
                return {
                    'language': 'en',
                    'confidence': 0.8,
                    'is_reliable': True
                }
        except Exception as e:
            return {
                'language': 'unknown',
                'confidence': 0.0,
                'is_reliable': False,
                'error': str(e)
            }

    def analyze_english_sentiment(self, text):
        """Analyze English text using TextBlob with enhanced lexicon support"""
        try:
            analysis = TextBlob(text)
            polarity = analysis.sentiment.polarity
            subjectivity = analysis.sentiment.subjectivity
            text_lower = text.lower()
            words = re.findall(r"\w+", text_lower)

            # English negative words with weights
            english_negative_words = {
                'poor': -0.5, 'crowded': -0.5, 'uncomfortable': -0.6, 'bad': -0.6,
                'terrible': -0.8, 'horrible': -0.8, 'awful': -0.7, 'worst': -1.0,
                'disappointing': -0.6, 'disappointed': -0.6, 'frustrating': -0.6,
                'boring': -0.5, 'waste': -0.6, 'useless': -0.6, 'disorganized': -0.6,
                'chaotic': -0.6, 'noisy': -0.4, 'late': -0.4, 'delayed': -0.4,
                'unprofessional': -0.6, 'rude': -0.6, 'slow': -0.4, 'confusing': -0.5,
                'shortened': -0.3, 'shorter': -0.2, 'improvement': -0.2, 'improve': -0.2,
                'lacking': -0.5, 'needs': -0.15, 'could': -0.1, 'should': -0.1,
                'disaster': -1.0, 'waited': -0.5, 'waiting': -0.4, 'hours': -0.3,
                'long': -0.3, 'hassle': -0.6, 'annoying': -0.6, 'annoyed': -0.6,
                'angry': -0.8, 'mad': -0.7, 'furious': -0.9,
                'starving': -2.0, 'hungry': -2.0, 'basic': -0.3, 'unprepared': -0.5,
                'mess': -1.0, 'messy': -0.8, 'regret': -1.5, 'regretted': -1.5,
                'outdated': -0.8, 'old': -0.4, 'failed': -1.0
            }
            
            # English positive words with weights
            english_positive_words = {
                'great': 0.6, 'excellent': 0.7, 'amazing': 0.7, 'wonderful': 0.7,
                'fantastic': 0.7, 'awesome': 0.6, 'perfect': 0.8, 'outstanding': 0.7,
                'love': 0.6, 'loved': 0.6, 'enjoy': 0.5, 'enjoyed': 0.5,
                'helpful': 0.5, 'informative': 0.5, 'organized': 0.5, 'smooth': 0.5,
                'relevant': 0.4, 'good': 0.4, 'nice': 0.4, 'satisfied': 0.5,
                'happy': 0.5, 'glad': 0.5, 'pleased': 0.5, 'impressed': 0.6,
                'forward': 0.5, 'waiting': 0.2, 'exceeded': 0.7, 'expectations': 0.5,
                'practical': 0.5, 'learnings': 0.4, 'inspiring': 0.6, 'productive': 0.5
            }
            
            # Contrast words that indicate mixed/neutral sentiment
            contrast_words = {'but', 'however', 'although', 'though', 'yet', 'except'}
            has_contrast = any(word in words for word in contrast_words)
            
            # Check for criticism patterns
            has_criticism_pattern = 'i feel like' in text_lower or 'could have been' in text_lower or 'should have been' in text_lower
            
            # Check for comparisons (often neutral/mixed context)
            has_comparison = 'better than' in text_lower or 'worse than' in text_lower or 'compared to' in text_lower
            
            # Use improved negation check including "none"
            negation_words = {'none', 'neither', 'nor', 'not', 'no', 'never'}
            
            # Intensifiers
            intensifiers = {'very', 'really', 'extremely', 'so', 'too', 'way', 'incredibly', 'absolutely'}
            
            # Calculate custom word scores
            custom_score = 0
            for i, word in enumerate(words):
                multiplier = 1.5 if (i > 0 and words[i-1] in intensifiers) else 1.0
                # Improved negation check
                # Check for "None of..." or standard negation
                is_negated = (i > 0 and words[i-1] in negation_words) or \
                            (i > 1 and words[i-2] in negation_words) or \
                            ('none' in words and word in english_positive_words) # "None of the topics were relevant"

                if i > 0 and words[i-1] == 'too' and word in english_positive_words:
                    custom_score -= 0.3 * multiplier
                elif word in english_negative_words:
                    val = english_negative_words[word] * multiplier
                    custom_score += -val if is_negated else val
                elif word in english_positive_words:
                    val = english_positive_words[word] * multiplier
                    custom_score += -val * 0.5 if is_negated else val # Penalty for negated positive
            
            # Combine TextBlob polarity with custom score
            if abs(polarity) < 0.1 and abs(custom_score) > 0.2:
                combined_polarity = custom_score * 0.8 + polarity * 0.2
            else:
                combined_polarity = polarity * 0.5 + custom_score * 0.5
            
            # Clamp to valid range
            combined_polarity = max(-1, min(1, combined_polarity))

            # Apply contrast penalty
            # If "but" is present, heavily suppress the score towards neutral
            if has_contrast:
                combined_polarity *= 0.3 # Stronger reduction (was 0.4)
                
            # If "okay" or "ok" is present with "better than", force closer to neutral
            is_okay_start = 'okay' in text_lower or 'ok' in text_lower
            if is_okay_start and has_comparison:
                combined_polarity *= 0.2
            
            # Classification
            if combined_polarity > 0.15: # Raised back to 0.15 for stricter positive
                sentiment = "positive"
            elif combined_polarity < -0.15: # Raised back to -0.15
                sentiment = "negative"
            else:
                sentiment = "neutral"

            confidence = min((abs(combined_polarity) + 0.2) * 1.2, 1.0)

            return {
                'sentiment': sentiment,
                'polarity': round(combined_polarity, 3),
                'textblob_polarity': round(polarity, 3),
                'custom_score': round(custom_score, 2),
                'subjectivity': round(subjectivity, 2),
                'confidence': round(confidence, 2),
                'has_contrast': has_contrast,
                'has_criticism_pattern': has_criticism_pattern,
                'method': 'textblob_enhanced'
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

            # Check for neutral indicators and track their positions
            # Neutral phrases with "lang" (just/only) indicate mild sentiment
            neutral_phrase_ranges = []
            for neutral in self.neutral_indicators:
                if neutral in text_lower:
                    neutral_count += 1
                    # Track the range of this neutral phrase so we can skip word-level scoring
                    for m in re.finditer(re.escape(neutral), text_lower):
                        neutral_phrase_ranges.append(range(m.start(), m.end()))

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
                
                # Skip if this word is part of a neutral phrase (e.g., "ayos" in "ayos lang")
                if any(word_start in r for r in neutral_phrase_ranges):
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

            # Special case depending on phrase dominance
            # If "hindi maintindihan" is found, weight it heavily
            if 'hindi maintindihan' in text_lower or 'di maintindihan' in text_lower:
                negative_score += 2.0

            # Analyze sentence balance
            positive_sentences = sum(1 for s in sentence_sentiments if s['balance'] > 0.5)
            negative_sentences = sum(1 for s in sentence_sentiments if s['balance'] < -0.5)
            neutral_sentences = len(sentence_sentiments) - positive_sentences - negative_sentences

            # Calculate final sentiment
            total_score = positive_score - negative_score

            # Sentiment determination
            has_mixed_sentiment = (positive_sentences > 0 and negative_sentences > 0) or constructive_criticism_count > 0
            has_significant_negative = negative_score >= 1.0
            has_strong_negative = negative_score >= 1.5  # Strong negative like "gulo" + "antay"
            score_ratio = abs(total_score) / max(positive_score + negative_score, 1)

            # PRIORITY 1: Strong negative score overrides neutral indicators
            if has_strong_negative and positive_score < negative_score:
                sentiment = "negative"
                confidence = min(0.6 + (abs(total_score) / 10), 0.95)
            # PRIORITY 2: Neutral indicators only if no strong sentiment (lowered threshold from 1.5 to 1.0)
            elif neutral_count >= 1 and positive_score < 1.0 and negative_score < 1.0:
                sentiment = "neutral"
                confidence = 0.75
            elif has_mixed_sentiment and (constructive_criticism_count >= 2 or has_significant_negative):
                sentiment = "neutral"
                confidence = 0.8
            elif total_score >= 0.5: # Lowered threshold from 0.7
                sentiment = "positive"
                confidence = min(0.6 + (total_score / 10), 0.95)
            elif total_score <= -0.5:
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

        # Check for contrast patterns that indicate mixed sentiment
        # "X was good, but Y needs improvement" should be neutral, not positive
        has_contrast = any(indicator in text_lower for indicator in self.contrast_indicators)
        if has_contrast and result.get('sentiment') in ['positive', 'negative']:
            # Check if there are both positive and negative indicators
            has_positive = any(phrase in text_lower for phrase in self.positive_phrases) or \
                          any(word in text_lower for word in self.tagalog_positive.keys())
            has_negative = any(phrase in text_lower for phrase in self.negative_phrases) or \
                          any(word in text_lower for word in self.tagalog_negative.keys())
            
            if has_positive and has_negative:
                # Mixed sentiment - classify as neutral
                result['sentiment'] = 'neutral'
                result['confidence'] = min(result.get('confidence', 0.5), 0.6)
                result['mixed_detected'] = True
                result['method'] = result.get('method', '') + '_contrast_mixed'

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
        # Debug: Print to stderr that script started
        print("🐍 Python script started", file=sys.stderr, flush=True)
        
        # Read input from stdin
        print("🐍 Waiting for stdin input...", file=sys.stderr, flush=True)
        input_data = sys.stdin.read()
        print(f"🐍 Received input: {len(input_data)} bytes", file=sys.stderr, flush=True)
        
        if not input_data:
            print(json.dumps({'success': False, 'error': 'No input data received'}))
            return

        data = json.loads(input_data)
        action = data.get('action')
        print(f"🐍 Action: {action}", file=sys.stderr, flush=True)

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
            print(f"🐍 Comment length: {len(comment)}, Lexicon entries: {len(lexicon) if lexicon else 0}", file=sys.stderr, flush=True)
            
            if not comment or not comment.strip():
                print(json.dumps({
                    'success': True,
                    'sentiment': 'neutral',
                    'confidence': 0.0,
                    'method': 'empty_text'
                }))
            else:
                print("🐍 Creating analyzer...", file=sys.stderr, flush=True)
                analyzer = MultilingualSentimentAnalyzer(custom_lexicon=lexicon)
                print("🐍 Analyzer created, running analysis...", file=sys.stderr, flush=True)
                result = analyzer.analyze_sentiment(comment)
                print("🐍 Analysis complete", file=sys.stderr, flush=True)
                print(json.dumps({
                    'success': True,
                    'sentiment': result.get('sentiment', 'neutral'),
                    'confidence': result.get('confidence', 0.5),
                    'method': result.get('method', 'unknown'),
                    'details': result
                }))

        elif action == 'analyze_batch':
            # Batch analysis: process multiple comments in a single Python invocation
            comments = data.get('comments', [])
            lexicon = data.get('lexicon', None)
            print(f"🐍 Batch analysis: {len(comments)} comments, Lexicon entries: {len(lexicon) if lexicon else 0}", file=sys.stderr, flush=True)
            
            analyzer = MultilingualSentimentAnalyzer(custom_lexicon=lexicon)
            results = []
            
            for i, comment in enumerate(comments):
                if not comment or not comment.strip():
                    results.append({
                        'sentiment': 'neutral',
                        'confidence': 0.0,
                        'method': 'empty_text'
                    })
                    continue
                
                try:
                    result = analyzer.analyze_sentiment(comment)
                    results.append({
                        'sentiment': result.get('sentiment', 'neutral'),
                        'confidence': result.get('confidence', 0.5),
                        'method': result.get('method', 'unknown'),
                    })
                except Exception as comment_err:
                    results.append({
                        'sentiment': 'neutral',
                        'confidence': 0.0,
                        'method': 'error_fallback',
                        'error': str(comment_err)
                    })
                
                # Progress logging every 100 comments
                if (i + 1) % 100 == 0:
                    print(f"🐍 Batch progress: {i + 1}/{len(comments)}", file=sys.stderr, flush=True)
            
            print(f"🐍 Batch analysis complete: {len(results)} results", file=sys.stderr, flush=True)
            print(json.dumps({
                'success': True,
                'results': results,
                'total': len(results)
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