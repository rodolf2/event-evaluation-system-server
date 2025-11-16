import React from 'react';
import { renderToString } from 'react-dom/server';

const RatingEmailTemplate = ({ participantName, questionText, ratingScore, maxScore = 10, adminName = 'Admin/Team' }) => {
  const filledStars = Math.floor(ratingScore);
  const hasHalfStar = ratingScore % 1 >= 0.5;
  const stars = Array(5).fill().map((_, i) => {
    if (i < filledStars) return '★';
    if (i === filledStars && hasHalfStar) return '☆';
    return '☆';
  }).join('');

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      lineHeight: 1.6,
      color: '#1f2937',
      maxWidth: '600px',
      margin: '0 auto',
      backgroundColor: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(-0.15deg, #324BA3 38%, #002474 100%)',
        padding: '2rem',
        textAlign: 'center',
        color: 'white',
        borderRadius: '12px 12px 0 0',
        marginBottom: '0'
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          margin: '0 0 0.5rem 0',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          📊 Rating Response Received
        </h1>
      </div>

      {/* Content */}
      <div style={{
        background: 'white',
        padding: '2.5rem',
        borderRadius: '0 0 12px 12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0,0, 0.1), 0 10px 10px -5px rgba(0, 0,0, 0.04)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '1.1rem', color: '#374151', marginBottom: '1rem' }}>
            <strong>Dear {adminName},</strong>
          </p>
          <p style={{ fontSize: '1rem', color: '#6b7280', marginBottom: '1.5rem' }}>
            {participantName} has submitted their rating for <strong>"{questionText}"</strong>:
          </p>
        </div>

        {/* Rating Display */}
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderRadius: '16px',
          padding: '2.5rem',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0,0, 0.1)'
        }}>
          <div style={{ fontSize: '4rem', fontWeight: '800', color: '#1e40af', marginBottom: '1rem' }}>
            {ratingScore.toFixed(1)}
          </div>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            {stars}
          </div>
          <div style={{ 
            fontSize: '1.2rem', 
            color: '#64748b', 
            fontWeight: '600',
            background: 'rgba(59, 130, 246, 0.1)',
            padding: '0.75rem 1.5rem',
            borderRadius: '9999px',
            display: 'inline-block'
          }}>
            {ratingScore}/{maxScore}
          </div>
        </div>

        <div style={{ 
          background: 'rgba(59, 130, 246, 0.05)', 
          borderLeft: '4px solid #3b82f6',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#1e40af' }}>
            <strong>Participant:</strong> {participantName}
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#1e40af' }}>
            <strong>Question:</strong> {questionText}
          </p>
        </div>

        <div style={{
          textAlign: 'center',
          paddingTop: '2rem',
          borderTop: '1px solid #e5e7eb',
          fontSize: '0.9rem',
          color: '#6b7280'
        }}>
          <p style={{ margin: 0, fontWeight: '500' }}>
            Best regards,
          </p>
          <p style={{ margin: '0.25rem 0 0 0', fontWeight: '600', color: '#1e40af' }}>
            Participant Feedback System
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '2rem 1rem 1rem',
        color: '#9ca3af',
        fontSize: '0.8rem'
      }}>
        <p style={{ margin: 0 }}>
          This is an automated message from the Event Evaluation System.
        </p>
      </div>
    </div>
  );
};

const generateRatingEmailHtml = (data) => renderToString(<RatingEmailTemplate {...data} />);

export { RatingEmailTemplate, generateRatingEmailHtml };