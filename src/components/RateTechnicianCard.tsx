import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_COMMENT } from '../models/reviews';
import { Order } from '../models/types';
import { useOrderReview } from '../viewModels/useReviews';
import { colors, font } from '../theme';
import { Banner, Card, PrimaryButton } from './ui';

function StarRow({ value, onPick, size = 30 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} disabled={!onPick} onPress={() => onPick?.(n)} hitSlop={6}
          accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} testID={`rate-star-${n}`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? colors.price : colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * "Rate your technician" (V2 feature 14). Shown on a finished job by a registered technician, in
 * the development build. Once rated, it shows the stars given instead of the form.
 */
export function RateTechnicianCard({ order, compact }: { order: Order; compact?: boolean }) {
  const { eligible, loaded, review, busy, error, submit } = useOrderReview(order);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  if (!eligible || !loaded) return null;

  if (review) {
    return (
      <Card>
        <Text style={font.small}>You rated {order.provider.name}</Text>
        <View style={{ marginTop: 6 }}><StarRow value={review.stars} size={compact ? 18 : 22} /></View>
        {review.comment && !compact ? <Text style={[font.small, { marginTop: 6 }]}>"{review.comment}"</Text> : null}
      </Card>
    );
  }

  return (
    <Card testID="rate-technician">
      <Text style={font.h3}>Rate your technician</Text>
      <Text style={[font.small, { marginTop: 2, marginBottom: 10 }]}>How was {order.provider.name}? Your rating helps other drivers.</Text>
      <StarRow value={stars} onPick={setStars} />
      {stars > 0 ? (
        <>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)"
            placeholderTextColor={colors.muted}
            maxLength={MAX_COMMENT}
            multiline
            style={{ marginTop: 12, minHeight: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.text, backgroundColor: colors.surfaceAlt }}
            testID="rate-comment"
          />
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Send rating" loading={busy} onPress={() => submit(stars, comment)} testID="rate-submit" />
          </View>
        </>
      ) : null}
      {error ? <View style={{ marginTop: 10 }}><Banner tone="danger" text={error} /></View> : null}
    </Card>
  );
}
