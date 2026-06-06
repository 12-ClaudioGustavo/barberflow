import { Router } from 'express';
import { servicesController } from '../controllers/servicesController.js';
import { employeesController } from '../controllers/employeesController.js';
import { availabilityController } from '../controllers/availabilityController.js';
import { appointmentsController } from '../controllers/appointmentsController.js';
import { dashboardController } from '../controllers/dashboardController.js';
import { financialController } from '../controllers/financialController.js';
import { waitlistController } from '../controllers/waitlistController.js';
import { authController } from '../controllers/authController.js';
import { clientsController } from '../controllers/clientsController.js';
import { superAdminController } from '../controllers/superAdminController.js';
import { notificationsController } from '../controllers/notificationsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { roleMiddleware } from '../middlewares/roleMiddleware.js';

const router = Router();

// =========================================================================
// ROTAS DE AUTENTICAÇÃO E CADASTRO (Auth & Signup)
// =========================================================================
router.post('/auth/signup', authController.signup);
router.get('/auth/tenants', authController.listTenants);

// =========================================================================
// ROTAS DE SUPER ADMIN (Gerenciamento Global da Plataforma)
// =========================================================================
router.get(
  '/super-admin/tenants',
  authMiddleware,
  roleMiddleware(['super_admin']),
  superAdminController.listTenants
);

router.patch(
  '/super-admin/tenants/:id/approve',
  authMiddleware,
  roleMiddleware(['super_admin']),
  superAdminController.approveTenant
);

router.patch(
  '/super-admin/tenants/:id/reject',
  authMiddleware,
  roleMiddleware(['super_admin']),
  superAdminController.rejectTenant
);

router.patch(
  '/super-admin/tenants/:id/suspend',
  authMiddleware,
  roleMiddleware(['super_admin']),
  superAdminController.suspendTenant
);

router.get(
  '/super-admin/stats',
  authMiddleware,
  roleMiddleware(['super_admin']),
  superAdminController.getStats
);

// =========================================================================
// ROTAS DE DASHBOARD E RELATÓRIOS (Dashboard & Metrics)
// =========================================================================
router.get(
  '/dashboard/metrics',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  dashboardController.getMetrics
);

// =========================================================================
// ROTAS FINANCEIRAS (Financials)
// =========================================================================
router.post(
  '/financial',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  financialController.create
);

router.get(
  '/financial',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  financialController.list
);

// =========================================================================
// ROTAS DE LISTA DE ESPERA (Waitlist)
// =========================================================================
router.post(
  '/waitlists',
  authMiddleware,
  waitlistController.add
);

router.get(
  '/waitlists',
  authMiddleware,
  roleMiddleware(['owner', 'manager', 'employee']),
  waitlistController.list
);

// =========================================================================
// ROTAS DE DISPONIBILIDADE E AGENDAMENTOS (Booking & Appointments)
// =========================================================================
router.get(
  '/booking/slots', // Público para o cliente final agendar
  availabilityController.getSlots
);

router.get(
  '/booking/weekly-slots',
  availabilityController.getWeekSlots
);

router.post(
  '/booking',
  authMiddleware, // Logado (pode ser cliente cadastrado ou funcionário)
  appointmentsController.create
);

router.get(
  '/booking',
  authMiddleware,
  appointmentsController.list
);

router.patch(
  '/booking/:id/status',
  authMiddleware,
  roleMiddleware(['owner', 'manager', 'employee']),
  appointmentsController.updateStatus
);

// =========================================================================
// ROTAS DE SERVIÇOS (Services)
// =========================================================================
router.get(
  '/services',
  authMiddleware, // Apenas usuários logados daquele tenant listam
  servicesController.list
);

router.post(
  '/services',
  authMiddleware,
  roleMiddleware(['owner', 'manager']), // Dono e Gerente podem criar
  servicesController.create
);

router.put(
  '/services/:id',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  servicesController.update
);

router.patch(
  '/services/:id/toggle',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  servicesController.toggleActive
);

// =========================================================================
// ROTAS DE FUNCIONÁRIOS (Employees)
// =========================================================================
router.get(
  '/employees',
  authMiddleware,
  employeesController.list
);

router.post(
  '/employees',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  employeesController.create
);

router.get(
  '/employees/:profileId/shifts',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  employeesController.getShifts
);

router.put(
  '/employees/:profileId/shifts',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  employeesController.updateShift
);

router.post(
  '/employees/timeoffs',
  authMiddleware,
  roleMiddleware(['owner', 'manager']),
  employeesController.createTimeoff
);

router.get(
  '/employees/timeoffs',
  authMiddleware,
  employeesController.listTimeoffs
);

// =========================================================================
// ROTAS DE CLIENTES (Clients)
// =========================================================================
router.get(
  '/clients/me',
  authMiddleware,
  clientsController.me
);

router.get(
  '/clients',
  authMiddleware,
  clientsController.list
);

router.post(
  '/clients',
  authMiddleware,
  clientsController.create
);

// =========================================================================
// ROTAS DE NOTIFICAÇÕES (Notifications)
// =========================================================================
router.get(
  '/notifications',
  authMiddleware,
  notificationsController.list
);

router.patch(
  '/notifications/read-all',
  authMiddleware,
  notificationsController.markAllAsRead
);

router.patch(
  '/notifications/:id/read',
  authMiddleware,
  notificationsController.markAsRead
);

export default router;
