export function createHealthController(supabase, readinessCheck) {
  return {
    live(req, res) {
      res.json({ status: 'ok', service: 'mit-clubs-api' });
    },
    async ready(req, res) {
      try {
        await readinessCheck?.();
        const { error } = await supabase.from('clubs').select('id').limit(1)
          .abortSignal(AbortSignal.timeout(5000));
        if (error) throw error;
        res.json({ status: 'ready' });
      } catch {
        // Never disclose DB errors or credentials to a health endpoint caller.
        res.status(503).json({ status: 'not_ready' });
      }
    },
  };
}
