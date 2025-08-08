"use client";

import { useState } from 'react';
import { useSendCalls } from 'wagmi';
import { parseEther } from 'viem';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useToast } from '~/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Send } from 'lucide-react';

interface TransferRecipient {
  address: string;
  amount: string;
}

export default function BatchTransfer() {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<TransferRecipient[]>([
    { address: '', amount: '' },
    { address: '', amount: '' }
  ]);
  const { sendCallsAsync, isPending: isSending, error: sendError } = useSendCalls();

  const addRecipient = () => {
    setRecipients([...recipients, { address: '', amount: '' }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const updateRecipient = (index: number, field: 'address' | 'amount', value: string) => {
    const updated = [...recipients];
    updated[index][field] = value;
    setRecipients(updated);
  };

  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const isValidAmount = (amount: string) => {
    try {
      const parsed = parseFloat(amount);
      return parsed > 0 && !isNaN(parsed);
    } catch {
      return false;
    }
  };

  const canSubmit = recipients.every(r => 
    isValidAddress(r.address) && isValidAmount(r.amount)
  );

  const handleBatchTransfer = async () => {
    if (!canSubmit) {
      toast({
        title: "Invalid Input",
        description: "Please check all addresses and amounts are valid",
        variant: "destructive"
      });
      return;
    }

    try {
      const calls = recipients.map(recipient => ({
        to: recipient.address as `0x${string}`,
        value: parseEther(recipient.amount)
      }));

      await sendCallsAsync({ calls });
      
      toast({
        title: "Transaction Submitted",
        description: "Your batch transfer has been submitted to the network",
      });
    } catch (error) {
      console.error('Batch transfer error:', error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : "Failed to submit batch transfer",
        variant: "destructive"
      });
    }
  };



  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Batch Transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {recipients.map((recipient, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Recipient {index + 1}</h4>
                {recipients.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => removeRecipient(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="0x..."
                  value={recipient.address}
                  onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                  className={!recipient.address || isValidAddress(recipient.address) ? '' : 'border-red-500'}
                />
                <Input
                  placeholder="Amount in ETH"
                  value={recipient.amount}
                  onChange={(e) => updateRecipient(index, 'amount', e.target.value)}
                  className={!recipient.amount || isValidAmount(recipient.amount) ? '' : 'border-red-500'}
                />
              </div>
            </div>
          ))}
        </div>

        <Button 
          variant="outline" 
          onClick={addRecipient}
          className="w-full"
        >
          Add Recipient
        </Button>


        <Button 
          onClick={handleBatchTransfer}
          disabled={!canSubmit || isSending}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Batch Transfer
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}