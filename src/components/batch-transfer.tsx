"use client";

import { useState } from 'react';
import { useSendCalls, useCallsStatus } from 'wagmi';
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
  const [batchId, setBatchId] = useState<string | undefined>();
  
  const { sendCallsAsync, isPending: isSending, error: sendError } = useSendCalls();
  
  const { 
    data: callsStatus, 
    isLoading: isWaitingForStatus, 
    error: statusError
  } = useCallsStatus({
    id: batchId!,
    query: { enabled: !!batchId },
  });

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

      const result = await sendCallsAsync({ calls });
      setBatchId(result.id);
      
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

  // Handle batch status updates
  if (callsStatus?.status === 'success') {
    toast({
      title: "Batch Transfer Successful",
      description: "All transfers in your batch have been confirmed on-chain",
    });
  }

  if (callsStatus?.status === 'failure' || statusError) {
    toast({
      title: "Batch Transfer Failed",
      description: "The batch transfer failed to complete",
      variant: "destructive"
    });
  }

  const getTransactionStatus = () => {
    if (isSending) return { icon: Loader2, text: "Submitting batch transfer...", color: "text-blue-600" };
    if (isWaitingForStatus) return { icon: Loader2, text: "Waiting for confirmation...", color: "text-yellow-600" };
    if (callsStatus?.status === 'success') return { icon: CheckCircle2, text: "Batch transfer successful!", color: "text-green-600" };
    if (callsStatus?.status === 'failure' || sendError || statusError) return { icon: XCircle, text: "Batch transfer failed", color: "text-red-600" };
    if (callsStatus?.status === 'pending') return { icon: Loader2, text: "Processing batch transfer...", color: "text-yellow-600" };
    return null;
  };

  const status = getTransactionStatus();

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

        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-lg bg-gray-50 ${status.color}`}>
            <status.icon className={`h-4 w-4 ${status.icon === Loader2 ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">{status.text}</span>
          </div>
        )}

        {batchId && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Batch ID:</p>
            <p className="text-xs font-mono break-all">{batchId}</p>
            {callsStatus?.status && (
              <p className="text-sm text-gray-600 mt-2">Status: <span className="font-medium">{callsStatus.status}</span></p>
            )}
          </div>
        )}

        <Button 
          onClick={handleBatchTransfer}
          disabled={!canSubmit || isSending || isWaitingForStatus}
          className="w-full"
        >
          {isSending || isWaitingForStatus ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isSending ? 'Submitting...' : 'Confirming...'}
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