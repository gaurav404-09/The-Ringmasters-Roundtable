export class BudgetAgent {
    async receiveMessage(message) {
      if (message.type === 'GET_BUDGET') {
        const { route, budget } = message.payload;
        const estimatedCost = (route?.distance || 0) * 10; // simple mock formula
        return { type: 'BUDGET_RESULT', payload: { estimatedCost, budgetLevel: budget }, requestId: message.requestId };
      }
      throw new Error(`BudgetAgent cannot handle message type ${message.type}`);
    }
  }
  