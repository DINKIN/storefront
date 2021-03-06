import { $ecomConfig } from '@ecomplus/utils'
import dictionary from './../../lib/dictionary'
import ecomPassport from '@ecomplus/passport-client'

export default {
  name: 'EcUser',

  props: {
    lang: {
      type: String,
      default: $ecomConfig.get('lang')
    },
    ecomPassport: {
      type: Object,
      default: () => ecomPassport
    },
    popoverPlacement: {
      type: String,
      default: 'bottomleft'
    },
    getGreetingsMsg: {
      type: Function
    },
    accountUrl: {
      type: String,
      default: '/app/#/account/'
    },
    ordersUrl: {
      type: String,
      default: '/app/#/account/orders'
    },
    popupAlertCountSecs: {
      type: Number,
      default: 3
    }
  },

  data () {
    return {
      showPopover: false,
      popoverTriggers: 'click blur',
      waiting: false,
      waitingPopup: false,
      isLogged: false,
      email: '',
      name: '',
      oauthProviders: [],
      showLoginForm: false,
      popupAlertCount: 0,
      loginErrorAlert: false,
      noProfileFound: false,
      popoverHideTimer: null
    }
  },

  computed: {
    greetings () {
      if (typeof this.getGreetingsMsg === 'function') {
        return this.getGreetingsMsg(this.name)
      } else {
        return `${dictionary('hello', this.lang)} ${this.name || dictionary('visitor', this.lang)}`
      }
    }
  },

  methods: {
    dictionary,

    update () {
      this.fixPopoverTriggers()
      const { checkLogin, getCustomerName } = this.ecomPassport
      this.name = getCustomerName()
      this.isLogged = checkLogin()
      this.email = ''
      this.popupAlertCount = 0
      if (this.isLogged) {
        this.showPopover = true
        setTimeout(() => {
          if (this.showPopover) {
            this.popoverHideTimer = setTimeout(() => {
              this.showPopover = false
            }, 2000)
          }
        }, 200)
      }
      this.waitingPopup = false
      clearTimeout(this.popoverHideTimer)
    },

    waitPromise (promise) {
      this.fixPopoverTriggers()
      const vm = this
      vm.waiting = true
      promise
        .catch(err => {
          console.error(err)
        })
        .finally(() => {
          vm.waiting = false
        })
    },

    setOauthProviders () {
      const vm = this
      const promise = vm.ecomPassport.fetchOauthProviders()
        .then(({ host, baseUri, oauthPath, providers }) => {
          const oauthProviders = []
          for (const provider in providers) {
            if (providers[provider]) {
              const { faIcon, providerName } = providers[provider]
              oauthProviders.push({
                link: host + baseUri + provider + oauthPath,
                faIcon,
                provider,
                providerName
              })
            }
          }
          vm.oauthProviders = oauthProviders
        })
        .catch(err => {
          vm.presetOauthProviders()
          throw err
        })
      vm.waitPromise(promise)
      return promise
    },

    presetOauthProviders () {
      this.oauthProviders = [
        {
          faIcon: 'fa-facebook-f',
          providerName: 'Facebook',
          provider: 'facebook'
        },
        {
          faIcon: 'fa-google',
          providerName: 'Google',
          provider: 'google'
        },
        {
          faIcon: 'fa-windows',
          providerName: 'Windows',
          provider: 'windowslive'
        }
      ]
    },

    oauthPopup (link, provider) {
      const vm = this
      this.loginErrorAlert = false
      if (link) {
        vm.ecomPassport.popupOauthLink(link)
        vm.waitingPopup = true
        setTimeout(() => {
          vm.popupAlertCount = vm.popupAlertCountSecs
        }, 200)
      } else {
        const promise = vm.setOauthProviders()
          .then(() => {
            const link = vm.oauthProviders
              .find(oauthProvider => oauthProvider.provider === provider)
            vm.oauthPopup(link, provider)
          })
          .catch(err => {
            vm.loginErrorAlert = true
            throw err
          })
        vm.waitPromise(promise)
      }
    },

    popupAlertChanged (countDown) {
      this.popupAlertCount = countDown
    },

    emailLoginSubmit (e) {
      const vm = this
      e.preventDefault()
      vm.showLoginForm = false
      const promise = vm.ecomPassport.fetchLogin(this.email)
        .catch(err => {
          const { response } = err
          if (response && response.status === 403) {
            vm.noProfileFound = true
          } else {
            setTimeout(() => {
              vm.loginErrorAlert = true
            }, 100)
            throw err
          }
        })
      vm.waitPromise(promise)
    },

    logout () {
      this.ecomPassport.logout()
    },

    resetErrors () {
      this.noProfileFound = this.loginErrorAlert = false
    },

    resetPopover () {
      if (this.showLoginForm) {
        this.showLoginForm = false
      } else {
        this.resetErrors()
      }
    },

    fixPopoverTriggers () {
      if (this.showPopover) {
        this.popoverTriggers = 'manual'
        setTimeout(() => {
          this.popoverTriggers = 'click blur'
        }, 310)
      }
    }
  },

  mounted () {
    const vm = this
    ;['login', 'logout'].forEach(ev => {
      this.ecomPassport.on(ev, payload => {
        vm.update()
        vm.$emit(ev, payload)
      })
    })
    vm.update()
    vm.setOauthProviders()
  },

  watch: {
    noProfileFound (newStatus) {
      if (newStatus === false) {
        this.email = ''
      }
      this.showLoginForm = !newStatus
    },

    showLoginForm (newStatus) {
      this.loginErrorAlert = false
      if (newStatus) {
        this.fixPopoverTriggers()
        setTimeout(() => {
          if (this.$refs.input) {
            this.$refs.input.focus()
          }
        }, 300)
      }
    },

    showPopover () {
      clearTimeout(this.popoverHideTimer)
    }
  }
}
