import { View } from 'react-native';
import { AlertCircle, BadgeCheck, Check, ShieldCheck } from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isVerified, trustScore, TRUST_LEVEL_LABEL, type TrustEvidence } from '@/lib/trust-score';

/**
 * The trust panel on a professional's profile.
 *
 * It shows the score, then the evidence behind every point, including what is
 * missing. A homeowner can see that the licence was checked against the state
 * register, or that it was not — rather than trusting a badge that means
 * nothing. Nothing says verified unless both checks have actually passed.
 */
export function TrustPanel({ evidence, now = new Date() }: { evidence: TrustEvidence | null; now?: Date }) {
  if (!evidence) {
    return (
      <Card className="py-5">
        <CardContent className="gap-2 px-5">
          <Text role="heading" className="text-base font-semibold">Trust & checks</Text>
          <Text className="text-muted-foreground text-[13px] leading-5">
            FixIt has not recorded checks for this professional yet.
          </Text>
        </CardContent>
      </Card>
    );
  }

  const result = trustScore(evidence, now);
  const verified = isVerified(evidence);

  return (
    <Card className="py-5">
      <CardContent className="gap-3 px-5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text role="heading" className="text-base font-semibold">Trust & checks</Text>
          <Badge variant="secondary">
            <Icon as={ShieldCheck} className="size-3.5" />
            <Text className="text-[11px] font-semibold">{TRUST_LEVEL_LABEL[result.level]}</Text>
          </Badge>
        </View>

        <View className="flex-row items-end gap-2">
          <Text className="text-3xl font-bold">{result.score}</Text>
          <Text className="text-muted-foreground pb-0.5 text-[13px]">
            out of 100 · {result.checksPassed} of {result.checksTotal} checks in place
          </Text>
        </View>

        {verified ? (
          <View className="flex-row items-start gap-2 rounded-lg bg-[#E6F4EA] px-3 py-2.5">
            <Icon as={BadgeCheck} className="mt-0.5 size-4 text-[#2E9E4F]" />
            <Text className="flex-1 text-[13px] font-bold text-[#2E9E4F]">
              Licence and insurance both checked by FixIt.
            </Text>
          </View>
        ) : (
          <View className="bg-muted flex-row items-start gap-2 rounded-lg px-3 py-2.5">
            <Icon as={AlertCircle} className="text-muted-foreground mt-0.5 size-4" />
            <Text className="text-muted-foreground flex-1 text-[12.5px] leading-5">
              Not marked verified. Being approved to list is not a licence or insurance check, and we
              only say verified when both have passed.
            </Text>
          </View>
        )}

        <View className="gap-2.5">
          {result.factors.map(factor => (
            <View key={factor.key} className="flex-row items-start gap-3">
              <Icon
                as={factor.missing ? AlertCircle : Check}
                className={
                  'mt-0.5 size-3.5 ' +
                  (factor.earned < 0 ? 'text-[#D93025]' : factor.missing ? 'text-muted-foreground' : 'text-[#2E9E4F]')
                }
              />
              <View className="flex-1">
                <Text className="text-[13.5px] font-semibold">{factor.label}</Text>
                <Text className="text-muted-foreground text-[12.5px] leading-5">{factor.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}
